import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';

const namespace = 'epav_migration';
const objects = ['snapshots', 'documents', 'document_fields', 'current_documents'];
const collections = ['arquivo_produtos_swift', 'auditoria_catalogo', 'importacoes_catalogo',
  'produtos_swift', 'ranking', 'sincronizacao_imagens_swift'];
const source = 'projects/epav-game/databases/(default)';

async function main() {
  const env = parseEnv(await readFile(process.argv[2] || '.env.neon-migration', 'utf8'));
  if (env.NEON_BRANCH_ID !== 'br-lucky-star-za2fy0sm') throw new Error('Use o arquivo da branch de teste.');
  const url = new URL(env.DATABASE_URL_UNPOOLED);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')
      || !url.hostname.startsWith('ep-jolly-glade-zat3ho4b.')) throw new Error('Use a conexão direta da branch de teste.');
  url.searchParams.set('sslmode', 'verify-full');
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 15000, enableChannelBinding: true });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const params = [namespace, objects];
    const { rows: relations } = await client.query(`
      SELECT c.relname AS name, CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS kind,
        CASE WHEN c.relkind='v' THEN pg_get_viewdef(c.oid, true) END AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=ANY($2) AND c.relkind IN ('r','v')`, params);
    const { rows: columns } = await client.query(`
      SELECT c.relname AS object, a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
        NOT a.attnotnull AS nullable, pg_get_expr(d.adbin,d.adrelid) AS "default"
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname=$1 AND c.relname=ANY($2) AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY c.relname,a.attnum`, params);
    const { rows: constraints } = await client.query(`
      SELECT c.relname AS object, con.conname AS name, con.contype AS kind, pg_get_constraintdef(con.oid,true) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=ANY($2) AND con.contype IN ('p','f','u','c')
      ORDER BY c.relname,con.contype,con.conname`, params);
    const { rows: indexes } = await client.query(`
      SELECT tablename AS object,indexname AS name,indexdef AS definition FROM pg_indexes
      WHERE schemaname=$1 AND tablename=ANY($2) ORDER BY tablename,indexname`, params);
    const { rows: [snapshot] } = await client.query(`
      SELECT source_read_time AS "readTime", document_count::int AS total
      FROM epav_migration.snapshots WHERE source_database=$1 ORDER BY source_read_time DESC LIMIT 1`, [source]);
    const { rows: counts } = await client.query(`
      SELECT split_part(d.collection_path,'/',1) AS name, count(*)::int AS count
      FROM epav_migration.current_documents d JOIN epav_migration.snapshots s ON s.id=d.snapshot_id
      WHERE s.source_database=$1 GROUP BY 1 ORDER BY 1`, [source]);
    if (relations.length !== objects.length || columns.some(column => /^(?:text|jsonb?)(?:\[\])?$/.test(column.type))
        || !snapshot || counts.some(row => !collections.includes(row.name))
        || counts.reduce((n,row) => n + row.count, 0) !== snapshot.total) {
      throw new Error('Confira os objetos, a lista pública de coleções e o manifesto antes de exportar.');
    }
    await client.query('COMMIT');
    const model = {
      schema: namespace, branch: 'epav-firestore-migration', capturedAt: new Date().toISOString(),
      snapshot: {...snapshot, collections: collections.map(name => ({name, count: counts.find(row=>row.name===name)?.count ?? 0}))},
      objects: objects.map(name => {
        const only = rows => rows.filter(row => row.object===name).map(({object,...rest}) => rest);
        return {...relations.find(row => row.name===name), columns:only(columns), constraints:only(constraints), indexes:only(indexes)};
      })
    };
    await writeFile(new URL('../site/schema.json', import.meta.url), JSON.stringify(model,null,2)+'\n');
    console.log(`Exportados ${model.objects.length} objetos e ${model.snapshot.collections.length} totais; sem registros individuais.`);
  } finally { await client.end(); }
}
main().catch(err => {
  console.error(err.code ? `Exportação falhou (${err.code}).` : err.message);
  process.exitCode = 1;
});
