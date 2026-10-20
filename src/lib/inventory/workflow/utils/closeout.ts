import { z } from 'zod';

const V = 'inventory.operations.validation';
const count = z.preprocess(value => value === '' ? undefined : value, z.coerce.number({ error: `${V}.countRequired` }).int().nonnegative().max(Number.MAX_SAFE_INTEGER));

/** `inventory.CloseoutCounts` body for `POST /inventory/closeouts/{id}/close`. */
export const closeoutSchema = z.object({
  lines: z.array(z.object({ itemId: z.string().min(1, `${V}.required`), available: count, quarantined: count })).superRefine((lines, ctx) => {
    if (new Set(lines.map(line => line.itemId)).size !== lines.length) ctx.addIssue({ code: 'custom', message: `${V}.countOnce` });
  }),
  financialDifferenceReason: z.string().trim(),
  notes: z.string(),
});
export type CloseoutInput = z.infer<typeof closeoutSchema>;
export type CloseoutPreview = { inventoryLines: { itemId: string; expectedAvailableEnding: number; expectedQuarantinedEnding: number }[]; financialDifferenceMinor: number; version: number };

/** Returns an i18n key under `inventory.operations.closeout.*`, or null when the counts reconcile. */
export function validateCloseout(input: CloseoutInput, preview: CloseoutPreview): string | null {
  if (!Array.isArray(preview.inventoryLines) || !Number.isSafeInteger(preview.version) || !Number.isSafeInteger(preview.financialDifferenceMinor)) return 'inventory.operations.closeout.previewIncomplete';
  const counts = new Map(input.lines.map(line => [line.itemId, line]));
  for (const line of preview.inventoryLines) {
    const counted = counts.get(line.itemId);
    if (!counted) return 'inventory.operations.closeout.countEveryItem';
    if (counted.available !== line.expectedAvailableEnding || counted.quarantined !== line.expectedQuarantinedEnding) return 'inventory.operations.closeout.classifyDifferences';
  }
  for (const counted of input.lines) {
    if (!preview.inventoryLines.some(line => line.itemId === counted.itemId) && (counted.available || counted.quarantined)) return 'inventory.operations.closeout.unexpectedStock';
  }
  if (preview.financialDifferenceMinor !== 0 && !input.financialDifferenceReason.trim()) return 'inventory.operations.closeout.explainDifference';
  return null;
}
