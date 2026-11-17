# EPAV · Modelagem de dados

**[Abrir o explorador do esquema](https://epav-game.github.io/epav-modelagem/)**

O site documenta o esquema PostgreSQL da branch de testes do EPAV no Neon. Ele mostra tabelas, chaves, índices, a definição da view e o total de documentos por coleção do Firestore na última cópia. Os nomes das coleções são apresentados separadamente porque elas ainda são armazenadas em JSONB, não em tabelas próprias.

| Caminho | Conteúdo |
| --- | --- |
| `migrations/` | SQL versionado |
| `scripts/migrate-firestore-to-neon.mjs` | Inventário, cópia e conferência do Firestore |
| `scripts/export-schema.mjs` | Geração local do inventário público de metadados |
| `site/` | Site estático publicado pelo GitHub Pages |
| [Guia de migração](docs/migracao-firestore-neon.md) | Ambiente, primeira cópia e etapa de troca dos serviços |

## Atualizar o explorador

1. Instale as dependências locais com `npm ci` (Node.js 24).
2. Use a conexão direta da branch de teste em `.env.neon-migration` (ou passe o caminho de um arquivo equivalente como argumento de `npm run schema:refresh -- caminho`). A varredura faz somente consultas de leitura.
3. Execute `npm run schema:refresh` e revise `site/schema.json`. O exportador só publica os objetos SQL e os nomes de coleção previstos no código, com totais agregados.
4. Envie o JSON revisado e o SQL correspondente ao GitHub para publicar. A data no site indica quando o metadado foi coletado.

O Pages publica somente `site/`. Conexões, credenciais, documentos individuais, identificadores de jogadores e dados internos do catálogo ficam fora do site e do Git.
