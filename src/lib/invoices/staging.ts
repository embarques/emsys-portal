/** Serialize invoice ids for a staging workspace tab (`entityId`). */
export function encodeStagingInvoiceIds(invoiceIds: string[]): string {
  return Array.from(new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))).sort().join(",");
}

export function decodeStagingInvoiceIds(entityId?: string): string[] {
  if (!entityId?.trim()) return [];
  return entityId.split(",").map((id) => id.trim()).filter(Boolean);
}
