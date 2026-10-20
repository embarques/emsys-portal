import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { API_ENDPOINTS, INVENTORY_WORKFLOW_ENDPOINTS } from '../../src/lib/api/endpoints.ts';
import {
  allResources,
  resources,
  ALLOCATION_TARGETS,
  DAMAGE_RESOLUTIONS,
  HOLDER_TYPES,
  MANUAL_DISPOSITION_TYPES,
  PAYMENT_METHODS,
  PRICING_MODES,
  STOCK_CONDITIONS,
} from '../../src/lib/inventory/workflow/resources.ts';
import { workflowSchema, toPayload } from '../../src/lib/inventory/workflow/schemas/workflow-schema.ts';
import { workflowWriteHeaders } from '../../src/lib/inventory/workflow/utils/request-headers.ts';

const swagger = JSON.parse(readFileSync(new URL('../fixtures/inventory-swagger-contract.json', import.meta.url), 'utf8'));
const definition = ref => swagger.definitions[ref.replace('#/definitions/', '')];
const requiredHeaders = operation => (operation.parameters ?? []).filter(p => p.in === 'header' && p.required).map(p => p.name);
const bodyRef = operation => (operation.parameters ?? []).find(p => p.in === 'body')?.schema?.$ref;
const enumOf = name => swagger.definitions[`inventory.${name}`].enum;

test('every workflow resource lists through a documented GET and /search', () => {
  for (const [key, path] of Object.entries(INVENTORY_WORKFLOW_ENDPOINTS)) {
    assert.ok(swagger.paths[path]?.get, `GET ${path} (${key})`);
    assert.ok(swagger.paths[`${path}/search`]?.post, `POST ${path}/search (${key})`);
  }
  for (const resource of allResources) assert.ok(INVENTORY_WORKFLOW_ENDPOINTS[resource.key], `endpoint for ${resource.key}`);
});

test('legacy inventory screens use documented paths and no undocumented DELETE/PUT', () => {
  for (const key of ['INVENTORY_ITEMS', 'INVENTORY_STOCK', 'INVENTORY_RECEIPTS', 'INVENTORY_DISPATCHES', 'INVENTORY_SUPPLIERS', 'INVENTORY_HOLDERS', 'INVENTORY_ADJUSTMENTS']) {
    const path = API_ENDPOINTS[key];
    assert.ok(swagger.paths[path]?.get, `GET ${path}`);
    assert.equal(swagger.paths[`${path}/{id}`]?.delete, undefined, `${path} has no DELETE`);
    assert.equal(swagger.paths[`${path}/{id}`]?.put, undefined, `${path} has no PUT`);
  }
  for (const path of ['/inventory/items/{id}', '/inventory/suppliers/{id}', '/inventory/receipts/{id}', '/inventory/dispatches/{id}']) {
    assert.deepEqual(requiredHeaders(swagger.paths[path].patch), ['If-Match'], `PATCH ${path} requires If-Match`);
  }
  for (const document of ['receipts', 'dispatches', 'adjustments']) {
    assert.ok(swagger.paths[`/inventory/${document}/{id}/post`].post, `${document} post`);
    assert.ok(swagger.paths[`/inventory/${document}/{id}/cancel`].post, `${document} cancel`);
  }
  assert.ok(swagger.paths['/inventory/holders/{id}/stock'].get);
});

test('create, edit, child and command routes exist with the documented method and headers', () => {
  for (const resource of resources) {
    const base = INVENTORY_WORKFLOW_ENDPOINTS[resource.key];
    if (resource.create) assert.ok(swagger.paths[base].post, `POST ${base}`);
    if (resource.edit) {
      const operation = swagger.paths[`${base}/{id}`][resource.editMethod];
      assert.ok(operation, `${resource.editMethod?.toUpperCase()} ${base}/{id}`);
      assert.ok(requiredHeaders(operation).includes('If-Match'), `${base} update requires If-Match`);
    }
    for (const child of resource.children ?? []) assert.ok(swagger.paths[`${base}/{id}/${child.path}`]?.get, `GET ${base}/{id}/${child.path}`);
    for (const command of resource.commands ?? []) {
      const path = `${base}/{id}/${command.path ?? command.action}`;
      const operation = swagger.paths[path]?.post;
      assert.ok(operation, `POST ${path}`);
      const required = requiredHeaders(operation);
      assert.equal(Boolean(command.versioned), required.includes('If-Match'), `${path} If-Match`);
      const headers = workflowWriteHeaders({ method: 'post', versioned: Boolean(command.versioned), version: 0, idempotencyKey: 'retry-key' });
      for (const name of required) assert.ok(headers[name], `${path} sends ${name}`);
    }
  }
  const release = swagger.paths['/inventory/payments/{id}/allocations/{allocationId}'].delete;
  const headers = workflowWriteHeaders({ method: 'delete', versioned: true, version: 4, idempotencyKey: 'k' });
  for (const name of requiredHeaders(release)) assert.ok(headers[name], `release sends ${name}`);
});

test('create forms only send documented body fields', () => {
  for (const resource of resources.filter(entry => entry.create)) {
    const ref = bodyRef(swagger.paths[INVENTORY_WORKFLOW_ENDPOINTS[resource.key]].post);
    const body = definition(ref);
    for (const field of resource.fields ?? []) assert.ok(field.name in body.properties, `${resource.key}.${field.name} in ${ref}`);
    if (resource.lines) {
      const linesKey = resource.linesKey ?? 'lines';
      const lineRef = body.properties[linesKey]?.items?.$ref;
      assert.ok(lineRef, `${resource.key} has ${linesKey}`);
      for (const field of resource.lines) assert.ok(field.name in definition(lineRef).properties, `${resource.key} line ${field.name} in ${lineRef}`);
    }
  }
  for (const resource of resources) {
    for (const command of (resource.commands ?? []).filter(entry => entry.fields)) {
      const operation = swagger.paths[`${INVENTORY_WORKFLOW_ENDPOINTS[resource.key]}/{id}/${command.path ?? command.action}`].post;
      const body = definition(bodyRef(operation));
      for (const field of command.fields) assert.ok(field.name in body.properties, `${resource.key}:${command.action}.${field.name}`);
      for (const [name] of Object.entries(command.fixed ?? {})) assert.ok(name in body.properties, `${command.action} fixed ${name}`);
    }
  }
});

test('select options match Swagger enums', () => {
  assert.deepEqual([...HOLDER_TYPES], enumOf('HolderType'));
  assert.deepEqual([...STOCK_CONDITIONS], enumOf('StockCondition'));
  assert.deepEqual([...PAYMENT_METHODS], enumOf('PaymentMethod'));
  assert.deepEqual([...DAMAGE_RESOLUTIONS], enumOf('DamageResolution'));
  assert.deepEqual([...PRICING_MODES], enumOf('PricingMode'));
  assert.deepEqual([...ALLOCATION_TARGETS], enumOf('AllocationTarget'));
  assert.deepEqual([...MANUAL_DISPOSITION_TYPES], enumOf('DispositionType').filter(type => type !== 'SOLD'));
  assert.deepEqual(enumOf('HandoverStatus'), ['PENDING', 'RECEIVED']);
  const payments = resources.find(entry => entry.key === 'payments');
  assert.deepEqual(payments.commands.filter(command => command.path === 'status').map(command => command.fixed.status), swagger.definitions['inventory.PaymentTransition'].properties.status.enum);
});

test('catalog form produces integer defaultSellingPriceMinor and only documented fields', () => {
  const resource = resources.find(entry => entry.key === 'items');
  const values = workflowSchema(resource).parse({ sku: 'BOX', name: 'Box', category: 'Supplies', unitOfMeasure: 'unit', defaultSellingPriceMinor: '19.99', reorderThreshold: '10' });
  const payload = toPayload(resource, values);
  const properties = swagger.definitions['inventory.Item'].properties;
  for (const key of Object.keys(payload)) assert.ok(key in properties, `Undocumented field: ${key}`);
  assert.equal(payload.defaultSellingPriceMinor, 1999);
});

test('versioned commands cannot omit the version Swagger requires', () => {
  const input = { method: 'post', versioned: true, idempotencyKey: 'retry-key' };
  assert.equal(workflowWriteHeaders({ ...input, version: 3 })['If-Match'], '3');
  assert.equal(workflowWriteHeaders({ ...input, version: 0 })['If-Match'], '0');
  assert.throws(() => workflowWriteHeaders({ ...input, version: undefined }), /versionRequired/);
  assert.throws(() => workflowWriteHeaders({ ...input, version: Number.NaN }), /versionRequired/);
  assert.equal(workflowWriteHeaders({ method: 'patch', versioned: true, version: 2, idempotencyKey: 'k' })['Idempotency-Key'], undefined);
});
