import type { InvoiceDocument } from "@/lib/invoices/documents";

let nextId = 0;
let documents: InvoiceDocument[] = [
  {
    id: "pdf",
    invoiceId: "invoice",
    name: "signed-invoice.pdf",
    originalName: "signed-invoice.pdf",
    mimeType: "application/pdf",
    size: 2048,
    version: 1,
    deleting: false,
    createdAt: "2026-10-15T18:00:00Z",
    createdBy: { name: "Hector Martinez" },
    updatedAt: "2026-10-16T02:00:00Z",
    updatedBy: { name: "Ana Perez" },
  },
  {
    id: "photo",
    invoiceId: "invoice",
    name: "delivery-receipt.jpg",
    originalName: "delivery-receipt.jpg",
    mimeType: "image/jpeg",
    size: 120000,
    version: 1,
    deleting: false,
    createdAt: "2026-10-15T17:00:00Z",
    createdBy: { name: "Ana Perez" },
  },
  {
    id: "phone",
    invoiceId: "invoice",
    name: "phone-photo.heic",
    originalName: "phone-photo.heic",
    mimeType: "image/heic",
    size: 2400000,
    version: 1,
    deleting: false,
    createdAt: "2026-10-15T16:00:00Z",
    createdBy: { name: "Ana Perez" },
  },
];
export async function fetchInvoiceDocuments() {
  return { items: [...documents] };
}
export async function fetchInvoiceDocumentLink(_invoice: string, id: string) {
  return {
    url:
      id === "pdf"
        ? "about:blank"
        : "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
    expiresAt: "2099-01-01T00:00:00Z",
    mimeType:
      documents.find((item) => item.id === id)?.mimeType || "image/jpeg",
  };
}
export async function uploadInvoiceDocument(
  _invoice: string,
  file: File,
  progress: (percent: number) => void,
) {
  progress(50);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const item = {
    ...documents[0],
    id: `uploaded-${++nextId}`,
    name: file.name,
    size: file.size,
  };
  documents = [item, ...documents];
  return item;
}
export async function renameInvoiceDocument(
  _invoice: string,
  document: InvoiceDocument,
  name: string,
) {
  documents = documents.map((item) =>
    item.id === document.id
      ? { ...item, name, version: item.version + 1 }
      : item,
  );
  return documents.find((item) => item.id === document.id)!;
}
export async function deleteInvoiceDocument(
  _invoice: string,
  document: InvoiceDocument,
) {
  documents = documents.filter((item) => item.id !== document.id);
}
