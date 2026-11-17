import assert from 'node:assert/strict';
import test from 'node:test';
import {flatten,rebuild,verifyFields} from '../scripts/typed-fields.mjs';

test('nested values, ordered lists, empty containers, nulls and full integer precision survive reconstruction', () => {
  const original = { product: { mapValue:{fields:{
    code:{integerValue:'9223372036854775807'},
    variants:{arrayValue:{values:[{doubleValue:2.75},{doubleValue:'NaN'},{booleanValue:false},{nullValue:null},{arrayValue:{}}]}},
    price:{mapValue:{fields:{}}}, logged:{timestampValue:'2026-11-17T12:00:00.123456Z'},
    mark:{bytesValue:'AAE='}, place:{geoPointValue:{latitude:0,longitude:1}},
    link:{referenceValue:'projects/p/databases/(default)/documents/products/a'},
  }}}};
  assert.deepEqual(rebuild(flatten(original)),original);
  assert.doesNotThrow(()=>verifyFields(original,flatten(original)));
});

test('unknown values, array gaps and changed values abort migration verification', () => {
  assert.throws(()=>flatten({bad:{unsupportedValue:1}}), /não reconhecida/);
  const original={list:{arrayValue:{values:[{stringValue:'first'},{stringValue:'second'}]}}};
  const rows=flatten(original);
  assert.throws(()=>rebuild([rows[0],rows[2]]), /não reconhecida/);
  rows[1].string_value='changed';
  assert.throws(()=>verifyFields(original,rows), /divergiu/);
});
