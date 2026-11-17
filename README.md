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

O explorador mostra apenas as tabelas do projeto e a view pública do catálogo. As cópias temporárias da migração foram retiradas da produção após criar uma branch de backup. Duas tabelas de suporte necessárias à API permanecem em `epav_internal`, fora do explorador. Elas conservam os valores originais e mantêm as tabelas de negócio na mesma transação das gravações.

Firebase permanece somente na autenticação e na permissão administrativa. Fotos ficam no Cloudflare R2 e consultas frequentes usam Redis. O navegador nunca recebe a conexão do Postgres ou registros individuais pelo site de modelagem.

## Scripts

- `migrations/001` e `002`: cópia completa e campos tipados.
- `migrations/003` e `004`: dados operacionais e ranking de até 500 pontos.
- `migrations/005`: tabelas correspondentes às coleções e relacionamentos.
- `migrations/006` e `007`: encerramento da migração e separação do armazenamento interno.
- `scripts/cleanup-storage.mjs`: limpeza em duas etapas, com conferência de dados e teste de escrita com rollback.
- `scripts/build-collection-model.mjs`: mapeamento explícito dos campos e geração de `005`.
- `scripts/apply-collection-model.mjs`: aplicação com conferência de totais, catálogo e transações.
- `scripts/export-schema.mjs`: exporta só a estrutura e as contagens para o explorador.

[Guia completo da migração](docs/migracao-firestore-neon.md).

`npm ci` instala os utilitários locais; `npm test` verifica importação, tipos e o inventário publicado. A publicação do site usa GitHub Pages pelo workflow deste repositório.
