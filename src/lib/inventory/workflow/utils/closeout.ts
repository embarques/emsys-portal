import { z } from 'zod';
export const closeoutSchema = z.object({
  countedItems: z.array(z.object({ itemId: z.string().min(1), available: z.preprocess(value => value === '' ? undefined : value, z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)), quarantined: z.preprocess(value => value === '' ? undefined : value, z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)) })).superRefine((lines, ctx) => {
    if (new Set(lines.map(line => line.itemId)).size !== lines.length) ctx.addIssue({ code: 'custom', message: 'Count each item once.' });
  }),
  financialDifferenceReason: z.string().trim(), notes: z.string(),
});
export type CloseoutInput = z.infer<typeof closeoutSchema>;
export type CloseoutPreview = { inventoryLines: { itemId: string; expectedAvailableEnding: number; expectedQuarantinedEnding: number }[]; financialDifferenceMinor: number; version: number };
export function validateCloseout(input: CloseoutInput, preview: CloseoutPreview): string | null {
  if (!Array.isArray(preview.inventoryLines) || !Number.isSafeInteger(preview.version) || !Number.isSafeInteger(preview.financialDifferenceMinor)) return 'The server preview is incomplete. Refresh before closing.';
  const counts = new Map(input.countedItems.map(line => [line.itemId, line]));
  for (const line of preview.inventoryLines) {
    const count = counts.get(line.itemId);
    if (!count) return 'Count every item, including quarantined stock.';
    if (count.available !== line.expectedAvailableEnding || count.quarantined !== line.expectedQuarantinedEnding) return 'Classify physical differences through posted dispositions or adjustments, then refresh.';
  }
  for (const count of input.countedItems) {
    if (!preview.inventoryLines.some(line => line.itemId === count.itemId) && (count.available || count.quarantined)) return 'Post an adjustment for unexpectedly found stock before closing.';
  }
  if (preview.financialDifferenceMinor !== 0 && !input.financialDifferenceReason.trim()) return 'Explain the financial difference before closing.';
  return null;
}
