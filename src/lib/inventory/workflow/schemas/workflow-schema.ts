import { z } from 'zod';
import type { Field, Resource } from '../types/workflow';

/** Issue messages are i18n keys under `inventory.operations.validation.*`. */
const V = 'inventory.operations.validation';

export function fieldSchema(field: Field): z.ZodType {
  let schema: z.ZodType;
  if (field.kind === 'money') {
    schema = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, `${V}.money`).transform(value => {
      const [whole, fraction = ''] = value.split('.');
      return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    }).pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER, `${V}.money`));
  } else if (field.kind === 'number') {
    schema = z.string().trim().min(1, `${V}.required`).regex(/^-?\d+$/, `${V}.integer`).transform(Number)
      .pipe(z.number().int().min(field.min ?? -Number.MAX_SAFE_INTEGER, `${V}.min`).max(Number.MAX_SAFE_INTEGER, `${V}.integer`));
  } else if (field.kind === 'select') {
    schema = z.string().refine(value => field.options?.includes(value), `${V}.option`);
  } else if (field.kind === 'datetime-local') {
    schema = z.string().refine(value => value.length > 0 && Number.isFinite(Date.parse(value)), `${V}.instant`).transform(value => new Date(value).toISOString());
  } else if (field.kind === 'date') {
    schema = z.iso.date(`${V}.date`);
  } else {
    schema = z.string().trim().min(1, `${V}.required`);
  }
  return field.optional ? z.preprocess(value => value === '' ? undefined : value, schema.optional()) : schema;
}

export function fieldsSchema(fields: Field[]) {
  return z.object(Object.fromEntries(fields.map(field => [field.name, fieldSchema(field)])));
}

type FormShape = Pick<Resource, 'key' | 'fields' | 'lines'>;

/** Header fields plus optional repeated lines, with the cross-field rules from inventory.md. */
export function workflowSchema(resource: FormShape) {
  const base = fieldsSchema(resource.fields ?? []);
  const group = z.object({ quantity: fieldSchema({ name: 'quantity', kind: 'number', min: 1 }), unitPriceMinor: fieldSchema({ name: 'unitPriceMinor', kind: 'money' }) });
  const lineShape = fieldsSchema(resource.lines ?? []).extend(resource.key === 'sales-reports' ? { priceBreakdowns: z.array(group).optional() } : {});
  const line = z.preprocess(raw => {
    if (resource.key === 'sales-reports' && raw && typeof raw === 'object' && 'pricingMode' in raw && raw.pricingMode === 'TOTAL_PER_ITEM') return { ...raw, priceBreakdowns: undefined };
    return raw;
  }, lineShape);
  return base.extend(resource.lines ? { lines: z.array(line).min(1, `${V}.linesRequired`) } : {}).superRefine((value, ctx) => {
    const data = value as Record<string, unknown>;
    const lines = (data.lines ?? []) as Record<string, unknown>[];
    const seen = new Set<string>();
    lines.forEach((entry, index) => {
      if (entry.itemId) {
        const key = `${entry.itemId}:${entry.condition ?? ''}`;
        if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['lines', index, 'itemId'], message: `${V}.duplicateLine` });
        seen.add(key);
      }
      if (data.type === 'DAMAGED' && !entry.damageResolution) ctx.addIssue({ code: 'custom', path: ['lines', index, 'damageResolution'], message: `${V}.damageResolution` });
      if (entry.quantityDelta === 0) ctx.addIssue({ code: 'custom', path: ['lines', index, 'quantityDelta'], message: `${V}.nonZero` });
      if (entry.pricingMode === 'PRICE_GROUPS') {
        const groups = (entry.priceBreakdowns ?? []) as { quantity: number; unitPriceMinor: number }[];
        const quantity = groups.reduce((sum, group) => sum + group.quantity, 0);
        const total = groups.reduce((sum, group) => sum + group.quantity * group.unitPriceMinor, 0);
        if (!groups.length || quantity !== entry.quantitySold || total !== entry.totalRevenueMinor || !Number.isSafeInteger(total)) ctx.addIssue({ code: 'custom', path: ['lines', index, 'priceBreakdowns'], message: `${V}.priceGroups` });
      }
    });
    if (['payments', 'cash-handovers', 'allocate', 'settlements'].includes(resource.key) && Number(data.amountMinor) <= 0) ctx.addIssue({ code: 'custom', path: ['amountMinor'], message: `${V}.positiveAmount` });
    if (resource.key === 'settlements' && Boolean(data.paymentId) === Boolean(data.handoverId)) ctx.addIssue({ code: 'custom', path: ['paymentId'], message: `${V}.settlementSource` });
    if (resource.key === 'daily-routes' && new Set(lines.map(entry => entry.employeeId)).size !== lines.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: `${V}.uniqueEmployee` });
    if (resource.key === 'holders' && data.type !== 'WAREHOUSE' && !data.entityId) ctx.addIssue({ code: 'custom', path: ['entityId'], message: `${V}.holderEntity` });
    if (data.fromHolderId && (data.fromHolderId === data.toHolderId || data.fromHolderId === data.toWarehouseHolderId)) ctx.addIssue({ code: 'custom', path: ['fromHolderId'], message: `${V}.sameHolder` });
  });
}

/** Maps validated form data to the Swagger request body, preserving server fields a PUT would otherwise clear. */
export function toPayload(resource: Pick<Resource, 'key' | 'linesKey'>, data: Record<string, unknown>, existing?: Record<string, unknown>) {
  const payload: Record<string, unknown> = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  if (['items', 'payments'].includes(resource.key)) payload.currency = 'USD';
  if (resource.key === 'cash-handovers') payload.paymentIds = String(payload.paymentIds).split(',').map(id => id.trim()).filter(Boolean);
  if (resource.linesKey && payload.lines) { payload[resource.linesKey] = payload.lines; delete payload.lines; }
  if (resource.key === 'daily-routes' && existing?.routeTemplateId) payload.routeTemplateId ??= existing.routeTemplateId;
  if (resource.key === 'suppliers') { payload.contacts ??= existing?.contacts ?? []; payload.addresses ??= existing?.addresses ?? []; }
  if (['items', 'suppliers', 'holders', 'route-crews'].includes(resource.key)) payload.isActive ??= existing?.isActive ?? true;
  if (resource.key === 'holders' && payload.type === 'WAREHOUSE') delete payload.entityId;
  if (resource.key === 'sales-reports') payload.lines = (payload.lines as Record<string, unknown>[]).map(line => ({ ...line, priceBreakdowns: line.pricingMode === 'PRICE_GROUPS' ? (line.priceBreakdowns as { quantity: number; unitPriceMinor: number }[]).map(group => ({ ...group, totalMinor: group.quantity * group.unitPriceMinor })) : [] }));
  return payload;
}
