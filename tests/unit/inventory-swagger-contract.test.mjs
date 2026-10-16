import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVENTORY_WORKFLOW_ENDPOINTS } from '../../src/lib/api/endpoints.ts';
import { resources } from '../../src/lib/inventory/workflow/resources.ts';
import { workflowSchema, toPayload } from '../../src/lib/inventory/workflow/schemas/workflow-schema.ts';
import { workflowWriteHeaders } from '../../src/lib/inventory/workflow/utils/request-headers.ts';

const swagger = JSON.parse(readFileSync(new URL('../fixtures/inventory-swagger-contract.json', import.meta.url), 'utf8'));
test('implemented catalog, holder and document routes match the captured live Swagger methods', () => {
  for (const key of ['holders', 'items', 'suppliers', 'receipts', 'dispatches']) {
    const path = INVENTORY_WORKFLOW_ENDPOINTS[key];
    assert.ok(swagger.paths[path]?.get, `GET ${path}`);
    assert.ok(swagger.paths[path]?.post, `POST ${path}`);
    assert.ok(swagger.paths[`${path}/{id}`]?.get, `GET ${path}/{id}`);
  }
});
test('catalog form produces documented fields, including integer defaultSellingPriceMinor', () => {
  const resource = resources.find(entry => entry.key === 'items');
  const values = workflowSchema(resource).parse({ sku: 'BOX', name: 'Box', category: 'Supplies', unitOfMeasure: 'unit', defaultSellingPriceMinor: '19.99', reorderThreshold: '10' });
  const payload = toPayload(resource, values);
  const properties = swagger.definitions['inventory.Item'].properties;
  for (const key of Object.keys(payload)) assert.ok(key in properties, `Undocumented field: ${key}`);
  assert.equal(payload.defaultSellingPriceMinor, 1999);
  assert.equal('defaultSellingPrice' in payload, false);
});
test('post/cancel cannot omit the draft version required by Swagger', () => {
  for (const resource of ['receipts', 'dispatches']) {
    for (const action of ['post', 'cancel']) {
      const path = `${INVENTORY_WORKFLOW_ENDPOINTS[resource]}/{id}/${action}`;
      const operation = swagger.paths[path].post;
      const input = { resource, action, idempotencyKey: 'retry-key', version: 3 };
      const headers = workflowWriteHeaders(input);
      for (const parameter of operation.parameters.filter(p => p.in === 'header' && p.required)) assert.ok(headers[parameter.name]);
      assert.equal(headers['If-Match'], '3');
      assert.throws(() => workflowWriteHeaders({ ...input, version: undefined }), /current version/);
      assert.throws(() => workflowWriteHeaders({ ...input, version: NaN }), /current version/);
    }
  }
});
