import {readFile} from 'node:fs/promises';
import {parseEnv,isDeepStrictEqual} from 'node:util';
import pg from 'pg';
const production=process.argv.includes('--production');
const phase=process.argv[3];
if(!['prepare','finalize'].includes(phase))throw Error('Fase: prepare ou finalize');
if(production && process.env.EPAV_CLEANUP_BACKUP_BRANCH_ID!=='br-noisy-cell-za5dlp8x')throw Error('Confirme a branch de backup antes de produção');
const env=parseEnv(await readFile(process.argv[2],'utf8'));
if(env.NEON_BRANCH_ID!==(production?'br-little-thunder-za0v0lnz':'br-lucky-star-za2fy0sm'))throw Error('Branch inesperada');
const url=new URL(env.DATABASE_URL_UNPOOLED);
if(!url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.'))throw Error('Conexão direta obrigatória');
url.searchParams.set('sslmode','verify-full');
const db=new pg.Client({connectionString:url.href,enableChannelBinding:true});await db.connect();
const tables=['produtos_swift','arquivo_produtos_swift','auditoria_catalogo','importacoes_catalogo','sincronizacao_imagens_swift','ranking',
 'produtos_swift_versoes','produtos_swift_dados_originais','produtos_swift_imagens','versoes_produtos_dados_originais','versoes_produtos_imagens'];
async function counts(){const result={};for(const name of tables)result[name]=(await db.query(`SELECT count(*)::int AS n FROM epav_data.${name}`)).rows[0].n;return result;}
try{
  await db.query('BEGIN');
  await db.query('SET LOCAL lock_timeout=\'15s\'');
  const before=await counts();
  const catalog=(await db.query('SELECT * FROM epav_data.products ORDER BY id')).rows;
  const moved=(await db.query("SELECT to_regclass('epav_internal.records') IS NOT NULL AS moved")).rows[0].moved;
  const schema=moved?'epav_internal':'epav_data';
  const fields=(await db.query(`SELECT count(*)::int AS n FROM ${schema}.record_fields`)).rows[0].n;
  if(phase==='prepare'&&!moved)await db.query(await readFile(new URL('../migrations/006-internal-storage.sql',import.meta.url),'utf8'));
  if(phase==='finalize'){
    if(!moved)throw Error('Aplique prepare antes de finalize');
    await db.query(await readFile(new URL('../migrations/007-remove-storage-aliases.sql',import.meta.url),'utf8'));
  }
  if(!isDeepStrictEqual(before,await counts()))throw Error('Uma contagem de negócio mudou');
  if(!isDeepStrictEqual(catalog,(await db.query('SELECT * FROM epav_data.products ORDER BY id')).rows))throw Error('O catálogo mudou');
  if(fields!==(await db.query('SELECT count(*)::int AS n FROM epav_internal.record_fields')).rows[0].n)throw Error('Perda de campos internos');
  await db.query('SAVEPOINT write_probe');
  const {rows:[product]}=await db.query(`SELECT r.document_id,r.revision,r.row_id FROM epav_internal.records r
    WHERE collection_path='produtos_swift' ORDER BY document_id LIMIT 1`);
  const {rows:[payload]}=await db.query(`SELECT jsonb_agg(
    CASE WHEN parent_no IS NULL AND field_name='nome'
      THEN jsonb_set(to_jsonb(f),'{string_value}',to_jsonb('EPAV cleanup probe'::varchar))
      ELSE to_jsonb(f) END ||jsonb_build_object('bytes_value',encode(bytes_value,'base64')) ORDER BY node_no) AS nodes
    FROM epav_internal.record_fields f WHERE document_row_id=$1`,[product.row_id]);
  await db.query("SELECT epav_data.put_record('produtos_swift',$1,$2,$3::jsonb)",[product.document_id,product.revision,JSON.stringify(payload.nodes)]);
  await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  if((await db.query('SELECT nome FROM epav_data.produtos_swift WHERE id=$1',[product.document_id])).rows[0].nome!=='EPAV cleanup probe')throw Error('Falha na escrita da API');
  await db.query('ROLLBACK TO SAVEPOINT write_probe');
  if(!isDeepStrictEqual(catalog,(await db.query('SELECT * FROM epav_data.products ORDER BY id')).rows))throw Error('Falha ao reverter o teste');
  const {rows:[bad]}=await db.query(`SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema IN ('epav_data','epav_internal') AND udt_name IN ('text','json','jsonb','_text','_json','_jsonb')`);
  if(bad.n)throw Error('Coluna com tipo proibido');
  if(phase==='finalize'&&(await db.query(`SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema='epav_data' AND table_name IN ('snapshots','documents','document_fields','current_documents','records','record_fields')`)).rows[0].n)throw Error('Objeto auxiliar ainda público');
  await db.query('COMMIT');
  console.log(JSON.stringify({branch:production?'production':'staging',phase,tables:before,preserved_fields:fields,write_and_rollback_verified:true,forbidden_columns:bad.n}));
}catch(e){await db.query('ROLLBACK');console.error('Limpeza cancelada:',e.code??e.message,e.routine??'');process.exitCode=1;}
finally{await db.end();}
