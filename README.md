# EPAV — Modelagem de dados

[Explorar tabelas e relacionamentos](https://epav-game.github.io/epav-modelagem/)

Esquema PostgreSQL real do projeto EPAV no Neon. Cada coleção possui sua tabela em `epav_data`:

| Tabela | Finalidade |
|---|---|
| `produtos_swift` | Catálogo ativo e classificações do jogo |
| `arquivo_produtos_swift` | Produtos arquivados e referência à cópia recuperável |
| `auditoria_catalogo` | Autoria e versões antes/depois das alterações |
| `importacoes_catalogo` | Origem, verificação e totais das importações |
| `sincronizacao_imagens_swift` | Estado das verificações de fotos |
| `ranking` | Resultados publicados pelos jogadores |

Fotos e os 36 campos originais da planilha ficam em tabelas relacionadas. Versões históricas têm seus próprios dados de origem e fotos. Preços, margens e volumes usam colunas numéricas; marcadores de ausência da planilha ficam em colunas de observação. Não existem colunas TEXT, JSON ou JSONB.

A produção possui 11 tabelas funcionais. As seis principais são complementadas pelas tabelas de fotos, dados originais e versões históricas necessárias à auditoria e à recuperação de produtos arquivados. A API lê e grava diretamente nessas tabelas. A edição e seu histórico usam a mesma transação e verificam a revisão do produto.

As tabelas temporárias de migração e de armazenamento genérico foram excluídas, incluindo o esquema interno e seus gatilhos de compatibilidade. Os registros antigos do Firestore também foram excluídos após a migração. As migrações anteriores permanecem no Git para documentar a evolução da estrutura.

Firebase permanece somente na autenticação e na permissão administrativa. Fotos ficam no Cloudflare R2 e consultas frequentes usam Redis. O navegador nunca recebe a conexão do Postgres ou registros individuais pelo site de modelagem.

## Scripts

- `migrations/001` e `002`: cópia completa e campos tipados.
- `migrations/003` e `004`: dados operacionais e ranking de até 500 pontos.
- `migrations/005`: tabelas correspondentes às coleções e relacionamentos.
- `migrations/006` e `007`: etapa histórica de encerramento das cópias de migração.
- `migrations/008` e `009`: acesso direto às tabelas relacionais e exclusão do armazenamento genérico.
- `scripts/direct-storage.mjs`: compara os dados e testa edição, conflito, auditoria, arquivamento e restauração antes e depois da limpeza.
- `scripts/cleanup-storage.mjs`: limpeza em duas etapas, com conferência de dados e teste de escrita com rollback.
- `scripts/build-collection-model.mjs`: mapeamento explícito dos campos e geração de `005`.
- `scripts/apply-collection-model.mjs`: aplicação com conferência de totais, catálogo e transações.
- `scripts/export-schema.mjs`: exporta só a estrutura e as contagens para o explorador.

[Guia completo da migração](docs/migracao-firestore-neon.md).

`npm ci` instala os utilitários locais; `npm test` verifica importação, tipos e o inventário publicado. A publicação do site usa GitHub Pages pelo workflow deste repositório.
