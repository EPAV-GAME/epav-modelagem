import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';

const namespace = ['epav_data'];
const objects = ['ranking','products','produtos_swift','produtos_swift_versoes',
  'produtos_swift_dados_originais','produtos_swift_imagens','versoes_produtos_dados_originais',
  'versoes_produtos_imagens','arquivo_produtos_swift','auditoria_catalogo','sincronizacao_imagens_swift'];
const collections = ['arquivo_produtos_swift', 'auditoria_catalogo',
  'produtos_swift', 'ranking', 'sincronizacao_imagens_swift'];

async function main() {
  const env = parseEnv(await readFile(process.argv[2] || '.env.neon-migration', 'utf8'));
  if (env.NEON_BRANCH_ID !== (process.argv.includes('--production')?'br-little-thunder-za0v0lnz':'br-lucky-star-za2fy0sm')) throw new Error('Use o arquivo da branch de teste.');
  const url = new URL(env.DATABASE_URL_UNPOOLED);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')
      || url.hostname.includes('-pooler.')) throw new Error('Use a conexão direta da branch de teste.');
  url.searchParams.set('sslmode', 'verify-full');
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 15000, enableChannelBinding: true });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const params = [namespace, objects];
    const { rows: relations } = await client.query(`
      SELECT n.nspname AS schema, c.relname AS name, CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS kind,
        CASE WHEN c.relkind='v' THEN pg_get_viewdef(c.oid, true) END AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=ANY($1::varchar[]) AND c.relname=ANY($2) AND c.relkind IN ('r','v')`, params);
    const { rows: columns } = await client.query(`
      SELECT c.relname AS object, a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
        NOT a.attnotnull AS nullable, pg_get_expr(d.adbin,d.adrelid) AS "default"
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname=ANY($1::varchar[]) AND c.relname=ANY($2) AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY c.relname,a.attnum`, params);
    const { rows: constraints } = await client.query(`
      SELECT c.relname AS object, con.conname AS name, con.contype AS kind, pg_get_constraintdef(con.oid,true) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=ANY($1::varchar[]) AND c.relname=ANY($2) AND con.contype IN ('p','f','u','c')
      ORDER BY c.relname,con.contype,con.conname`, params);
    const { rows: indexes } = await client.query(`
      SELECT tablename AS object,indexname AS name,indexdef AS definition FROM pg_indexes
      WHERE schemaname=ANY($1::varchar[]) AND tablename=ANY($2) ORDER BY tablename,indexname`, params);
    if (relations.length !== objects.length || columns.some(column => /^(?:text|jsonb?)(?:\[\])?$/.test(column.type))) {
      throw new Error('Confira as tabelas de negócio e os tipos antes de exportar.');
    }
    const expectedTables = relations.filter(row=>row.kind==='table').map(row=>row.name).sort();
    const {rows:allTables}=await client.query(`SELECT schemaname,tablename FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename`);
    if(allTables.length!==expectedTables.length || allTables.some(row=>row.schemaname!=='epav_data' || !expectedTables.includes(row.tablename))) {
      throw new Error('Existem tabelas fora do modelo funcional. Confira a limpeza antes de publicar.');
    }
    const application = {schema:'epav_data',tables:[]};
    for(const name of collections) {
      const {rows:[row]}=await client.query(`SELECT count(*)::int AS count FROM epav_data.${name}`);
      application.tables.push({name,count:row.count});
    }
    await client.query('COMMIT');
    const model = {
      schema: namespace.join(' + '), branch: process.argv.includes('--production')?'production':'epav-firestore-migration', capturedAt: new Date().toISOString(),
      application,
      objects: objects.map(name => {
        const only = rows => rows.filter(row => row.object===name).map(({object,...rest}) => rest);
        return {...relations.find(row => row.name===name), columns:only(columns), constraints:only(constraints), indexes:only(indexes)};
      })
    };
    await writeFile(new URL('../site/schema.json', import.meta.url), JSON.stringify(model,null,2)+'\n');
    console.log(`Exportados ${model.objects.length} objetos e ${model.application.tables.length} totais; sem registros individuais.`);
  } finally { await client.end(); }
}
main().catch(err => {
  console.error(err.code ? `Exportação falhou (${err.code}).` : err.message);
  process.exitCode = 1;
});
