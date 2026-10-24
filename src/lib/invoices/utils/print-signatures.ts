import type { InvoiceSignatureOptions, InvoiceSignatureSelection, InvoicePrintDelivery, ReceiverSignatureOption } from "../schemas/invoice-print.schema";

function newest(signatures: ReceiverSignatureOption[]): ReceiverSignatureOption | undefined {
  return signatures.reduce<ReceiverSignatureOption | undefined>((current, candidate) => {
    if (!current) return candidate;
    const date = Date.parse(candidate.signedAt ?? "") || 0;
    const previous = Date.parse(current.signedAt ?? "") || 0;
    return date > previous || (date === previous && candidate.id > current.id) ? candidate : current;
  }, undefined);
}

export function buildInvoiceSignatureSelections(rows: InvoiceSignatureOptions[], mode: "first" | "sender" | "latest" = "first", trip?: InvoicePrintDelivery): InvoiceSignatureSelection[] {
  return rows.map((row) => ({
    invoiceId: row.invoiceId,
    includeSender: row.senderSignature !== null,
    receiverSignatureId: trip
      ? newest(row.receiverSignatures.filter((signature) => signature.deliveryId === trip.deliveryId))?.id ?? ""
      : mode === "first" ? row.receiverSignatures[0]?.id ?? ""
        : mode === "latest" ? newest(row.receiverSignatures)?.id ?? "" : "",
  }));
}

export function validateInvoiceSignatureSelections(rows: InvoiceSignatureOptions[], selections: InvoiceSignatureSelection[]): boolean {
  const options = new Map(rows.map((row) => [row.invoiceId, row]));
  if (rows.length !== selections.length) return false;
  for (const selection of selections) {
    const row = options.get(selection.invoiceId);
    if (!row || (selection.includeSender && !row.senderSignature) || (selection.receiverSignatureId && !row.receiverSignatures.some((signature) => signature.id === selection.receiverSignatureId))) return false;
    options.delete(selection.invoiceId);
  }
  return options.size === 0;
}
