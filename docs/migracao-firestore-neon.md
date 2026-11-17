# Migração do Firestore para Postgres no Neon

## Primeira etapa: copiar e conferir

Origem: Firestore `epav-game`, banco `(default)`. Destino: [projeto Neon small-meadow-02162774](https://console.neon.tech/app/projects/small-meadow-02162774/) na organização `org-super-voice-51320341`.

- `.env.local`: conexões com pool (`DATABASE_URL`) e direta (`DATABASE_URL_UNPOOLED`) da branch `production`.
- `.env.neon-migration`: conexões da branch isolada `epav-firestore-migration`. O importador exige a conexão direta dessa branch.
- Os dois arquivos e `.neon` são ignorados pelo Git. O site estático nunca recebe nenhuma URL do banco.
- No repositório de modelagem, é possível indicar outro arquivo local para a branch de teste com a variável `EPAV_MIGRATION_ENV_FILE`. O script continua validando a branch e o endpoint antes de conectar.
- Use `GOOGLE_APPLICATION_CREDENTIALS` com uma credencial que tenha permissão IAM de leitura no **projeto de origem**, ou as credenciais padrão do Google com a mesma permissão. Uma conta de jogador ou uma claim de admin do Firebase Authentication não dá acesso IAM a esta exportação.

Com Node.js 24 e `npm ci` no repositório:

```sh
node scripts/migrate-firestore-to-neon.mjs check-production
node scripts/migrate-firestore-to-neon.mjs inventory --top-level
node scripts/migrate-firestore-to-neon.mjs prepare
node scripts/migrate-firestore-to-neon.mjs apply
node scripts/migrate-firestore-to-neon.mjs verify
```

Para atualizar uma cópia da versão antiga do esquema, execute `migrate-types --dry-run` no mesmo script e revise o resultado. Em seguida, execute `migrate-types` para confirmar. O script reconstrói cada documento a partir das linhas tipadas e compara os valores antes de remover a coluna antiga, na mesma transação. Nenhum dado de origem é alterado.

`verify` abre uma nova conexão ao Neon e compara as contagens visíveis com a cópia confirmada, sem consultar o Firestore.

### Primeira cópia verificada

Em 17 de novembro de 2026, às 09:11 no horário de São Paulo, o único banco Firestore do projeto (`(default)`) tinha 5.646 documentos na leitura consistente, todos confirmados na branch de testes:

| Coleção | Documentos |
| --- | ---: |
| `arquivo_produtos_swift` | 2.777 |
| `auditoria_catalogo` | 4 |
| `importacoes_catalogo` | 1 |
| `produtos_swift` | 918 |
| `sincronizacao_imagens_swift` | 1.946 |

O inventário da cópia não encontrou documentos em `ranking`.

## Esquema tipado

- `snapshots` identifica cada cópia. `documents` guarda o caminho, a coleção, o ID do documento e suas datas.
- `document_fields` guarda os valores em colunas como `VARCHAR`, `BIGINT`, `BOOLEAN`, `TIMESTAMPTZ` e `BYTEA`. Mapas e arrays têm linhas filhas e os arrays mantêm sua ordem.
- `current_documents` expõe os metadados da cópia mais recente. As tabelas e a view não têm colunas `TEXT`, `JSON` ou `JSONB`. A tipagem desta cópia não troca o banco dos jogos.
- O JSON usado temporariamente como parâmetro dos lotes do importador é apenas o formato de transporte; os valores são gravados nas colunas tipadas, sem uma coluna contendo o documento serializado.

Não há um JSON inteiro guardado em `VARCHAR`: cada valor fica em sua coluna tipada. Os textos usam `VARCHAR` com tamanho definido, inteiros usam `BIGINT`, decimais da origem usam `DOUBLE PRECISION`, datas usam `TIMESTAMPTZ`, e os binários usam `BYTEA`. A enumeração `firestore_kind` e as restrições de cada linha validam qual coluna deve estar preenchida. As relações `document_row_id` e `parent_no` preservam documentos, mapas e listas sem perder sua estrutura.

`check-production` executa somente uma consulta de conexão. `inventory` lista contagens; sem `--top-level`, inclui subcoleções. `prepare` cria o esquema de migração somente na branch de testes e reverte a gravação de exemplo. `apply` descobre todas as coleções e subcoleções do banco, inclusive sob documentos pai ausentes. Lê tudo em um mesmo instante do Firestore, em páginas. Cada cópia guarda caminho, IDs, datas e campos com os tipos originais do Firestore, incluindo inteiros de 64 bits e referências. O script compara os valores gravados e as contagens antes de confirmar a transação. Uma falha cancela a cópia inteira. As cópias anteriores permanecem disponíveis e a view `epav_migration.current_documents` aponta para a mais recente.

## Troca dos serviços

As regras e o código atual indicam pelo menos estes consumidores:

| Dados | Leitura e escrita a migrar |
| --- | --- |
| `produtos_swift` | Avaliador e catálogo compartilhado, painel administrativo e robô de imagens |
| `arquivo_produtos_swift`, `sincronizacao_imagens_swift` | Arquivo do catálogo e acompanhamento do robô de imagens |
| `importacoes_catalogo`, `auditoria_catalogo` | Importador e painel; edição de produto e auditoria precisam ocorrer na mesma transação |
| `ranking` | API pública de consulta, publicação pelos dois jogos e listagem no painel |
| Outras coleções ou subcoleções | Inventário da origem antes de decidir quais precisam de acesso na API |

1. Comparar contagens e dados na branch isolada. Derivar tabelas ou consultas de catálogo, ranking e auditoria do formato realmente encontrado.
2. Adaptar os serviços para consultar e gravar no Postgres por uma API autenticada. Preservar o UID, a claim de admin, as validações de publicação, a separação entre catálogo público e dados internos e o cache do Redis.
3. Testar escrita de ranking, edição com auditoria, sincronização de imagem e recomendações de ambas as versões. Verificar que o navegador só usa a API.
4. Coordenar uma janela para suspender escritas antigas, importar uma cópia final, conferir a diferença e apontar os serviços ao Neon. Se houver retorno ao Firestore após aceitar escritas no Neon, reconciliar essas escritas antes de reabrir o Firestore.

Firebase Authentication continua responsável pelo login e pela recuperação de senha; as fotos continuam no R2. Esses serviços não são coleções do Firestore. A primeira etapa não troca a origem dos jogos nem altera o Firestore.

Referências: [API REST do Firestore](https://firebase.google.com/docs/firestore/reference/rest), [conexões com pool no Neon](https://neon.com/docs/connect/connection-pooling).
