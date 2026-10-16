import { z } from 'zod';
import type { Field, Resource } from '../types/workflow';

export function fieldSchema(field: Field): z.ZodType {
  let schema: z.ZodType;
  if (field.kind === 'money') {
    schema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a USD amount with at most two decimals.').transform(value => {
      const [whole, fraction = ''] = value.split('.');
      return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    }).pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
  } else if (field.kind === 'number') {
    schema = z.string().trim().min(1, 'Required').transform(Number).pipe(z.number().int().min(field.min ?? -Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER));
  } else if (field.kind === 'select') {
    schema = z.string().refine(value => field.options?.includes(value), 'Choose an option.');
  } else if (field.kind === 'datetime-local') {
    schema = z.string().refine(value => value.length > 0 && Number.isFinite(Date.parse(value)), 'Enter a valid date and time.').transform(value => new Date(value).toISOString());
  } else if (field.kind === 'date') {
    schema = z.iso.date();
  } else {
    schema = z.string().trim().min(1, 'Required');
  }
  return field.optional ? z.preprocess(value => value === '' ? undefined : value, schema.optional()) : schema;
}
export function fieldsSchema(fields: Field[]) {
  return z.object(Object.fromEntries(fields.map(field => [field.name, fieldSchema(field)])));
}
export function workflowSchema(resource: Resource) {
  const base = fieldsSchema(resource.fields ?? []);
  const group = z.object({ quantity: fieldSchema({ name: 'quantity', label: '', kind: 'number', min: 1 }), unitPriceMinor: fieldSchema({ name: 'unitPriceMinor', label: '', kind: 'money' }) });
  const lineShape = fieldsSchema(resource.lines ?? []).extend(resource.key === 'supply-sales-reports' ? { priceBreakdowns: z.array(group).optional() } : {});
  const line = z.preprocess(raw => {
    if (resource.key === 'supply-sales-reports' && raw && typeof raw === 'object' && 'pricingMode' in raw && raw.pricingMode === 'TOTAL_PER_ITEM') return { ...raw, priceBreakdowns: undefined };
    return raw;
  }, lineShape);
  return base.extend(resource.lines ? { lines: z.array(line).min(1, 'Add at least one item.') } : {}).superRefine((value, ctx) => {
    const data = value as Record<string, unknown>;
    const lines = (data.lines ?? []) as Record<string, unknown>[];
    const seen = new Set<string>();
    lines.forEach((entry, index) => {
      const key = `${entry.itemId}:${entry.condition ?? ''}`;
      if (entry.itemId && seen.has(key)) ctx.addIssue({ code: 'custom', path: ['lines', index, 'itemId'], message: 'Combine duplicate item/condition lines.' });
      seen.add(key);
      if (data.type === 'DAMAGED' && !entry.damageResolution) ctx.addIssue({ code: 'custom', path: ['lines', index, 'damageResolution'], message: 'Choose quarantine or write-off.' });
      if (entry.quantityDelta === 0) ctx.addIssue({ code: 'custom', path: ['lines', index, 'quantityDelta'], message: 'Adjustment must be nonzero.' });
      if (entry.pricingMode === 'PRICE_GROUPS') {
        const groups = (entry.priceBreakdowns ?? []) as { quantity: number; unitPriceMinor: number }[];
        const quantity = groups.reduce((sum, group) => sum + group.quantity, 0);
        const total = groups.reduce((sum, group) => sum + group.quantity * group.unitPriceMinor, 0);
        if (!groups.length || quantity !== entry.quantitySold || total !== entry.totalRevenueMinor || !Number.isSafeInteger(total)) ctx.addIssue({ code: 'custom', path: ['lines', index, 'priceBreakdowns'], message: 'Price groups must match quantity sold and actual revenue.' });
      }
    });
    if (['payments', 'cash-handovers', 'payment-allocations'].includes(resource.key) && Number(data.amountMinor) <= 0) ctx.addIssue({ code: 'custom', path: ['amountMinor'], message: 'Amount must be greater than zero.' });
    if (resource.key === 'daily-routes' && new Set(lines.map(line => line.employeeId)).size !== lines.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'List each employee once.' });
    if (resource.key === 'holders' && data.type !== 'WAREHOUSE' && !data.entityId) ctx.addIssue({ code: 'custom', path: ['entityId'], message: 'An employee, vehicle or crew reference is required.' });
    if (data.fromHolderId && (data.fromHolderId === data.toHolderId || data.fromHolderId === data.toWarehouseHolderId)) ctx.addIssue({ code: 'custom', path: ['fromHolderId'], message: 'Source and destination must differ.' });
  });
}
export function toPayload(resource: Resource, data: Record<string, unknown>, existing?: Record<string, unknown>) {
  const payload = { ...data };
  if (['items', 'payments'].includes(resource.key)) payload.currency = 'USD';
  if (resource.key === 'cash-handovers') payload.paymentIds = String(payload.paymentIds).split(',').map(id => id.trim()).filter(Boolean);
  if (resource.key === 'daily-routes') { payload.members = payload.lines; delete payload.lines; }
  if (resource.key === 'suppliers') { payload.contacts ??= existing?.contacts ?? []; payload.addresses ??= existing?.addresses ?? []; }
  if (['items', 'suppliers', 'holders', 'route-crews'].includes(resource.key)) payload.isActive ??= existing?.isActive ?? true;
  if (resource.key === 'supply-sales-reports') payload.lines = (payload.lines as Record<string, unknown>[]).map(line => ({ ...line, priceBreakdowns: line.pricingMode === 'PRICE_GROUPS' ? (line.priceBreakdowns as { quantity: number; unitPriceMinor: number }[]).map(group => ({ ...group, totalMinor: group.quantity * group.unitPriceMinor })) : [] }));
  return payload;
}
