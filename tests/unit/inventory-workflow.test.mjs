import test from 'node:test';
import assert from 'node:assert/strict';
import { resources } from '../../src/lib/inventory/workflow/resources.ts';
import { workflowSchema, fieldSchema, toPayload } from '../../src/lib/inventory/workflow/schemas/workflow-schema.ts';
import { closeoutSchema, validateCloseout } from '../../src/lib/inventory/workflow/utils/closeout.ts';
const resource = key => resources.find(entry => entry.key === key);
const dispatch = { fromHolderId: 'warehouse', toHolderId: 'truck', assigneeEmployeeId: '', dailyRouteId: '', dispatchedAt: '2026-10-15T13:00', notes: '', lines: [{ itemId: 'box', quantity: '30' }, { itemId: 'barrel', quantity: '10' }] };
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
  const schema = fieldSchema({ name: 'amountMinor', kind: 'money' });
  assert.equal(schema.parse('19.99'), 1999);
  assert.equal(schema.parse('0.29'), 29);
  for (const value of ['-1', '1.001', '', '900719925474099100']) assert.equal(schema.safeParse(value).success, false);
});
test('damage needs a resolution and SOLD cannot be entered manually', () => {
  const schema = workflowSchema(resource('dispositions'));
  const input = { holderId: 'truck', type: 'DAMAGED', description: 'Crushed boxes', occurredAt: '2026-10-15T13:00', closeoutId: '', dailyRouteId: '', lines: [{ itemId: 'box', quantity: '2', damageResolution: '', description: '' }] };
  assert.equal(schema.safeParse(input).success, false);
  assert.equal(schema.safeParse({ ...input, type: 'SOLD' }).success, false);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], damageResolution: 'QUARANTINE' }] }).success, true);
});
test('grouped sales reconcile quantities and actual revenue', () => {
  const config = resource('sales-reports');
  const schema = workflowSchema(config);
  const input = { holderId: 'truck', businessDate: '2026-10-15', closeoutId: '', notes: '', lines: [{ itemId: 'box', quantitySold: '10', pricingMode: 'PRICE_GROUPS', totalRevenueMinor: '570', priceBreakdowns: [{ quantity: '7', unitPriceMinor: '60' }, { quantity: '3', unitPriceMinor: '50' }] }] };
  const parsed = schema.parse(input);
  assert.equal(toPayload(config, parsed).lines[0].priceBreakdowns[0].totalMinor, 42000);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], totalRevenueMinor: '600' }] }).success, false);
  assert.equal(schema.safeParse({ ...input, lines: [{ ...input.lines[0], quantitySold: '11' }] }).success, false);
});
const preview = { version: 2, financialDifferenceMinor: 5000, inventoryLines: [{ itemId: 'box', expectedAvailableEnding: 7, expectedQuarantinedEnding: 2 }] };
const counts = { lines: [{ itemId: 'box', available: 7, quarantined: 2 }], financialDifferenceReason: 'Approved unpaid supply sale', notes: '' };
test('closeout accepts explained financial shortfall and fully reconciled physical counts', () => {
  assert.equal(validateCloseout(counts, preview), null);
  assert.match(validateCloseout({ ...counts, financialDifferenceReason: '' }, preview), /explainDifference/);
});
test('closeout blocks absent counts, quarantined differences and unexpected stock', () => {
  assert.match(validateCloseout({ ...counts, lines: [] }, preview), /countEveryItem/);
  assert.match(validateCloseout({ ...counts, lines: [{ itemId: 'box', available: 7, quarantined: 0 }] }, preview), /classifyDifferences/);
  assert.match(validateCloseout({ ...counts, lines: [...counts.lines, { itemId: 'barrel', available: 1, quarantined: 0 }] }, preview), /unexpectedStock/);
});
test('blank counts do not become zero; duplicate counts and stale previews are rejected', () => {
  assert.equal(closeoutSchema.safeParse({ ...counts, lines: [{ itemId: 'box', available: '', quarantined: '' }] }).success, false);
  assert.equal(closeoutSchema.safeParse({ ...counts, lines: [...counts.lines, ...counts.lines] }).success, false);
  assert.match(validateCloseout(counts, { ...preview, version: undefined }), /previewIncomplete/);
});
test('only drafts can post and reopen requires the dedicated capability', () => {
  assert.deepEqual(resource('dispatches').commands.find(command => command.action === 'post').states, ['DRAFT']);
  const reopen = resource('closeouts').commands.find(command => command.action === 'reopen');
  assert.equal(reopen.permission, 'closeout.reopen');
  assert.deepEqual(reopen.states, ['CLOSED']);
  assert.equal(resource('counts').commands[0].body, 'entity-lines');
});
test('switching back to total-per-item ignores unfinished price groups', () => {
  const schema = workflowSchema(resource('sales-reports'));
  const parsed = schema.parse({ holderId: 'truck', businessDate: '2026-10-15', closeoutId: '', notes: '', lines: [{ itemId: 'box', quantitySold: '2', pricingMode: 'TOTAL_PER_ITEM', totalRevenueMinor: '100', priceBreakdowns: [{ quantity: '', unitPriceMinor: '' }] }] });
  assert.equal(parsed.lines[0].totalRevenueMinor, 10000);
  assert.equal(parsed.lines[0].priceBreakdowns, undefined);
});
test('editing supplier name preserves existing contacts, addresses and inactive status', () => {
  const existing = { companyName: 'Old', isActive: false, contacts: [{ name: 'Warehouse desk' }], addresses: ['Main Street'] };
  const payload = toPayload(resource('suppliers'), { companyName: 'New' }, existing);
  assert.equal(payload.companyName, 'New');
  assert.equal(payload.isActive, false);
  assert.deepEqual(payload.contacts, existing.contacts);
  assert.deepEqual(payload.addresses, existing.addresses);
});
test('daily routes send members and keep the route template on PUT; warehouses drop entityId', () => {
  const routes = resource('daily-routes');
  const parsed = workflowSchema(routes).parse({ businessDate: '2026-10-15', vehicleId: 'truck-1', crewId: '', lines: [{ employeeId: '7', role: 'driver' }] });
  const payload = toPayload(routes, parsed, { routeTemplateId: 'tpl-1' });
  assert.deepEqual(payload.members, [{ employeeId: '7', role: 'driver' }]);
  assert.equal('lines' in payload, false);
  assert.equal(payload.routeTemplateId, 'tpl-1');
  assert.equal(workflowSchema(routes).safeParse({ ...parsed, businessDate: '2026-10-15', crewId: '', lines: [{ employeeId: '7', role: 'driver' }, { employeeId: '7', role: 'helper' }] }).success, false);
  const holders = resource('holders');
  assert.equal('entityId' in toPayload(holders, { type: 'WAREHOUSE', entityId: 'x', displayName: 'Main' }), false);
  assert.equal(workflowSchema(holders).safeParse({ type: 'EMPLOYEE', entityId: '', displayName: 'Ana' }).success, false);
});
