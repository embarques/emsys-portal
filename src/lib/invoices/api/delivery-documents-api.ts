import { fetchInvoiceDocuments, uploadInvoiceDocument } from "@/lib/invoices/api/invoice-documents-api";
import { MAX_DOCUMENT_BYTES } from "@/lib/invoices/documents";

/** One sequence across extensions, including names retained after a manual rename. */
export function deliveryDocumentNumber(name: string | undefined): number {
  const match = /^delivery_(\d+)(?:\..+)?$/i.exec(name?.trim() ?? "");
  const value = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function nameDeliveryDocument(file: File, number: number): File {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Invalid delivery document number.");
  const extension = /\.[^.\/\\]+$/.exec(file.name)?.[0] ?? "";
  return new File([file], `delivery_${number}${extension}`, { type: file.type, lastModified: file.lastModified });
}

/** Metadata only; follow every cursor so a later page cannot cause reused numbers. */
export async function nextDeliveryDocumentNumber(invoiceId: string, assertContext: () => void): Promise<number> {
  let highest = 0;
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    assertContext();
    const page = await fetchInvoiceDocuments(invoiceId, cursor);
    for (const item of page.items) {
      highest = Math.max(highest, deliveryDocumentNumber(item.name), deliveryDocumentNumber(item.originalName));
    }
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor)) throw new Error("Unable to read all invoice documents.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  if (!Number.isSafeInteger(highest + 1)) throw new Error("Delivery document sequence exhausted.");
  return highest + 1;
}

export async function uploadDeliveryDocuments(input: {
  invoiceId: string;
  companyId: string;
  files: File[];
  assertContext: () => void;
  onProgress: (index: number, name: string, percent: number) => void;
  onUploaded: (index: number, name: string) => void;
}): Promise<void> {
  if (!input.files.length) return;
  if (input.files.some((file) => !file.size || file.size > MAX_DOCUMENT_BYTES)) throw new Error("Invalid document size.");
  const upload = async () => {
    const first = await nextDeliveryDocumentNumber(input.invoiceId, input.assertContext);
    for (const [index, original] of input.files.entries()) {
      input.assertContext();
      const file = nameDeliveryDocument(original, first + index);
      input.onProgress(index, file.name, 0);
      // Sequential writes preserve selection order and stop at the first failure.
      await uploadInvoiceDocument(input.invoiceId, file, (percent) => input.onProgress(index, file.name, percent));
      input.onUploaded(index, file.name);
    }
  };
  // Serialize this invoice's delivery batches across tabs in supporting browsers.
  // Cross-device allocation still requires an atomic counter in the API.
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(`invoice-delivery-documents:${input.companyId}:${input.invoiceId}`, upload);
  } else {
    await upload();
  }
}
