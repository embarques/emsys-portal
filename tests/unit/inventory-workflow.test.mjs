import test from 'node:test';
import assert from 'node:assert/strict';
import { resources } from '../../src/lib/inventory/workflow/resources.ts';
import { workflowSchema, fieldSchema, toPayload } from '../../src/lib/inventory/workflow/schemas/workflow-schema.ts';
import { closeoutSchema, validateCloseout } from '../../src/lib/inventory/workflow/utils/closeout.ts';
const resource = key => resources.find(entry => entry.key === key);
const dispatch = { fromHolderId: 'warehouse', toHolderId: 'truck', dailyRouteId: '', dispatchedAt: '2026-10-15T13:00', lines: [{ itemId: 'box', quantity: '30' }, { itemId: 'barrel', quantity: '10' }] };
test('dispatch supports multiple items without revenue and restricts holder selectors', () => {
  const config = resource('dispatches');
  const parsed = workflowSchema(config).parse({ ...dispatch, incomeGained: 120 });
  assert.equal(parsed.lines.length, 2);
  assert.equal(parsed.lines[0].quantity, 30);
  assert.equal('incomeGained' in parsed, false);
  assert.equal(config.fields.find(field => field.name === 'toHolderId').reference, 'custodian');
  assert.equal(resource('returns').fields.find(field => field.name === 'toWarehouseHolderId').reference, 'warehouse');
});
test('dispatch rejects empty, fractional, duplicate and self-transfer lines', () => {
  const schema = workflowSchema(resource('dispatches'));
  for (const lines of [[], [{ itemId: 'box', quantity: '0' }], [{ itemId: 'box', quantity: '1.5' }], [{ itemId: 'box', quantity: '1' }, { itemId: 'box', quantity: '2' }]]) assert.equal(schema.safeParse({ ...dispatch, lines }).success, false);
  assert.equal(schema.safeParse({ ...dispatch, toHolderId: 'warehouse' }).success, false);
});
test('USD converts exactly to integer cents and rejects excess precision or unsafe values', () => {
  const schema = fieldSchema({ name: 'amountMinor', label: '', kind: 'money' });
  assert.equal(schema.parse('19.99'), 1999);
  assert.equal(schema.parse('0.29'), 29);
  for (const value of ['-1', '1.001', '', '900719925474099100']) assert.equal(schema.safeParse(value).success, false);
});
test('damage needs a resolution and SOLD cannot be separately posted', () => {
  const schema = workflowSchema(resource('dispositions'));
  const input = { holderId: 'truck', type: 'DAMAGED', description: 'Crushed boxes', occurredAt: '2026-10-15T13:00', lines: [{ itemId: 'box', quantity: '2', damageResolution: '' }] };
  assert.equal(schema.safeParse(input).success, false);
  assert.equal(schema.safeParse({ ...input, type: 'SOLD' }).success, false);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], damageResolution: 'QUARANTINE' }] }).success, true);
});
test('grouped sales reconcile quantities and actual revenue', () => {
  const config = resource('supply-sales-reports');
  const schema = workflowSchema(config);
  const input = { holderId: 'truck', businessDate: '2026-10-15', lines: [{ itemId: 'box', quantitySold: '10', pricingMode: 'PRICE_GROUPS', totalRevenueMinor: '570', priceBreakdowns: [{ quantity: '7', unitPriceMinor: '60' }, { quantity: '3', unitPriceMinor: '50' }] }] };
  const parsed = schema.parse(input);
  assert.equal(toPayload(config, parsed).lines[0].priceBreakdowns[0].totalMinor, 42000);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], totalRevenueMinor: '600' }] }).success, false);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], quantitySold: '11' }] }).success, false);
});
const preview = { version: 2, financialDifferenceMinor: 5000, inventoryLines: [{ itemId: 'box', expectedAvailableEnding: 7, expectedQuarantinedEnding: 2 }] };
const counts = { countedItems: [{ itemId: 'box', available: 7, quarantined: 2 }], financialDifferenceReason: 'Approved unpaid supply sale', notes: '' };
test('closeout accepts explained financial shortfall and fully reconciled physical counts', () => {
  assert.equal(validateCloseout(counts, preview), null);
  assert.match(validateCloseout({ ...counts, financialDifferenceReason: '' }, preview), /Explain/);
});
test('closeout blocks absent counts, quarantined differences and unexpected stock', () => {
  assert.match(validateCloseout({ ...counts, countedItems: [] }, preview), /Count every/);
  assert.match(validateCloseout({ ...counts, countedItems: [{ itemId: 'box', available: 7, quarantined: 0 }] }, preview), /Classify/);
  assert.match(validateCloseout({ ...counts, countedItems: [...counts.countedItems, { itemId: 'barrel', available: 1, quarantined: 0 }] }, preview), /unexpectedly/);
});
test('blank counts do not become zero; duplicate counts and stale previews are rejected', () => {
  assert.equal(closeoutSchema.safeParse({ ...counts, countedItems: [{ itemId: 'box', available: '', quarantined: '' }] }).success, false);
  assert.equal(closeoutSchema.safeParse({ ...counts, countedItems: [...counts.countedItems, ...counts.countedItems] }).success, false);
  assert.match(validateCloseout(counts, { ...preview, version: undefined }), /incomplete/);
});
test('only drafts can post and reopen requires the dedicated capability', () => {
  assert.deepEqual(resource('dispatches').commands.find(command => command.action === 'post').states, ['DRAFT']);
  assert.equal(resource('closeouts').commands[0].permission, 'closeout.reopen');
  assert.deepEqual(resource('closeouts').commands[0].states, ['CLOSED']);
});
test('switching back to total-per-item ignores unfinished price groups', () => {
  const schema = workflowSchema(resource('supply-sales-reports'));
  const parsed = schema.parse({ holderId: 'truck', businessDate: '2026-10-15', lines: [{ itemId: 'box', quantitySold: '2', pricingMode: 'TOTAL_PER_ITEM', totalRevenueMinor: '100', priceBreakdowns: [{ quantity: '', unitPriceMinor: '' }] }] });
  assert.equal(parsed.lines[0].totalRevenueMinor, 10000);
  assert.equal(parsed.lines[0].priceBreakdowns, undefined);
});
test('editing supplier name preserves existing contacts, addresses and inactive status', () => {
  const existing = { companyName: 'Old', isActive: false, contacts: [{ name: 'Warehouse desk' }], addresses: [{ street: 'Main Street' }] };
  const payload = toPayload(resource('suppliers'), { companyName: 'New' }, existing);
  assert.equal(payload.companyName, 'New');
  assert.equal(payload.isActive, false);
  assert.deepEqual(payload.contacts, existing.contacts);
  assert.deepEqual(payload.addresses, existing.addresses);
});
