import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const model = JSON.parse(await readFile(new URL('../site/schema.json', import.meta.url),'utf8'));
const sql = (await Promise.all(['001-firestore-snapshots.sql','002-typed-document-fields.sql'].map(
  file=>readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))).join('\n');

test('public explorer matches the migration objects and the actual foreign key', () => {
  const ddlObjects = [...sql.matchAll(/CREATE (?:TABLE(?: IF NOT EXISTS)?|VIEW) epav_migration\.(\w+)/g)].map(m=>m[1]);
  assert.deepEqual(model.objects.map(o=>o.name),ddlObjects);
  assert.deepEqual(model.objects.map(o=>o.kind),['table','table','table','view']);
  assert.ok(model.objects[1].constraints.some(c=>c.kind==='f' && /FOREIGN KEY \(snapshot_id\).*snapshots\(id\)/.test(c.definition)));
  assert.ok(model.objects[1].constraints.some(c=>c.kind==='p' && /\(snapshot_id, path\)/.test(c.definition)));
  assert.ok(model.objects[2].constraints.some(c=>c.kind==='f' && /FOREIGN KEY \(document_row_id\).*documents\(row_id\)/.test(c.definition)));
  assert.deepEqual(model.objects[3].columns.map(c=>c.name),model.objects[1].columns.map(c=>c.name));
  assert.ok(model.objects.flatMap(o=>o.columns).every(c=>! /^(?:text|jsonb?)(?:\[\])?$/.test(c.type)));
});

test('the collection inventory reconciles and holds counts only, not documents', () => {
  assert.ok(model.snapshot.total>0);
  assert.equal(model.snapshot.total,model.snapshot.collections.reduce((sum,c)=>sum+c.count,0));
  assert.equal(new Set(model.snapshot.collections.map(c=>c.name)).size,model.snapshot.collections.length);
  for(const row of model.snapshot.collections) {
    assert.deepEqual(Object.keys(row).sort(),['count','name']);
    assert.ok(Number.isInteger(row.count) && row.count>=0);
  }
  assert.doesNotMatch(JSON.stringify(model),/postgres(?:ql)?:\/\/|BEGIN PRIVATE KEY|access_token/i);
});
