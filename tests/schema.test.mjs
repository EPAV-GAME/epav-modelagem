import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const model = JSON.parse(await readFile(new URL('../site/schema.json', import.meta.url),'utf8'));
const sql = (await Promise.all(['001-firestore-snapshots.sql','002-typed-document-fields.sql','003-application-data.sql','005-collection-tables.sql'].map(
  file=>readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))).join('\n');

const retired=['snapshots','documents','document_fields','current_documents','records','record_fields'];
test('explorer contains only real business tables and their keys', () => {
  const ddlObjects = [...sql.matchAll(/CREATE (?:TABLE(?: IF NOT EXISTS)?|VIEW) epav_data\.(\w+)/g)].map(m=>m[1]);
  assert.deepEqual(model.objects.map(o=>o.name).sort(),[...new Set(ddlObjects)].filter(n=>!retired.includes(n)).sort());
  assert.equal(model.objects.filter(o=>o.kind==='view').length,1);
  assert.ok(model.objects.every(o=>o.schema==='epav_data' && !retired.includes(o.name)));
  for(const table of model.application.tables)assert.equal(model.objects.find(o=>o.name===table.name)?.kind,'table');
  assert.ok(model.objects.find(o=>o.name==='produtos_swift').constraints.some(c=>c.kind==='f' && c.definition.includes('importacoes_catalogo')));
  assert.ok(model.objects.find(o=>o.name==='auditoria_catalogo').constraints.some(c=>c.kind==='f' && c.definition.includes('produtos_swift_versoes')));
  assert.ok(model.objects.flatMap(o=>o.columns).every(c=>! /^(?:text|jsonb?)(?:\[\])?$/.test(c.type)));
});
test('published inventory has totals and schema only, without records or credentials', () => {
  assert.equal(model.application.tables.length,6);
  assert.ok(model.application.tables.reduce((n,t)=>n+t.count,0)>0);
  assert.equal(new Set(model.application.tables.map(t=>t.name)).size,6);
  for(const row of model.application.tables) {
    assert.deepEqual(Object.keys(row).sort(),['count','name']);
    assert.ok(Number.isInteger(row.count) && row.count>=0);
  }
  assert.doesNotMatch(JSON.stringify(model),/postgres(?:ql)?:\/\/|BEGIN PRIVATE KEY|access_token/i);
});
