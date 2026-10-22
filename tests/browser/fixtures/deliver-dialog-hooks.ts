import type { Invoice } from "@/lib/invoices/types";

declare global {
  interface Window {
    deliverReadOnly?: boolean;
    deliverNoPolicies?: boolean;
    deliverNoReceiverId?: boolean;
    deliverPoliciesFail?: boolean;
    deliverStatusFail?: number;
    deliverStatusPatches?: { invoiceId: string; patches: { barcodeId: string; number: string; status: { id: number; name: string } }[] }[];
    deliverDocumentReads?: number;
    deliverDocumentAttempts?: string[];
    deliverDocumentSaved?: string[];
    deliverDocumentFailAt?: number;
    deliverMoved?: boolean;
    deliverExtra?: boolean;
    deliverSignatureFail?: boolean;
    deliverReads?: number;
    deliverSignatureWrites?: unknown[];
    delivered?: boolean;
  }
}
const state = { auth: { companyId: "company-1", idToken: "session-1" } };
export const store = { getState: () => state };
export function useAppSelector<T>(select: (value: typeof state) => T) { return select(state); }
export function useAuth() {
  return { isAuthenticated: true, user: { uid: "driver-1" }, email: "driver@example.test", hasPermission: () => !window.deliverReadOnly };
}
export async function fetchInvoiceById(): Promise<Invoice> {
  window.deliverReads = (window.deliverReads ?? 0) + 1;
  const barcode = (id: string, routeId = "route-1", statusId = 4, statusName = "ALM-RD") => ({
    id, barcodeId: id, number: id, routeId, deliveryId: routeId === "route-1" ? "5" : "6", statusId, statusName,
  });
  return {
    invoiceId: "invoice-1", invoiceNumber: "INV-1", containerId: "container-1",
    receiver: window.deliverNoReceiverId ? null : { id: "receiver-1", name: "Maria Perez", documentId: "001-0000000-1", phones: [], addresses: [], orderAddressId: "" },
    lineItems: [
      { id: "line-1", itemName: "Box", description: "Large box", quantity: 1, labelCount: 2, unitPrice: 0, lineTotal: 0, barcodes: [barcode("A", window.deliverMoved ? "other-route" : "route-1"), barcode("B", "route-1", 7, "ENTREGADO")] },
      { id: "line-2", itemName: "Chair", description: "Wooden chair", quantity: 1, labelCount: 1, unitPrice: 0, lineTotal: 0, barcodes: [barcode("C"), ...(window.deliverExtra ? [barcode("E")] : [])] },
      { id: "line-3", itemName: "Other route item", quantity: 1, labelCount: 1, unitPrice: 0, lineTotal: 0, barcodes: [barcode("D", "other-route")] },
    ],
  } as Invoice;
}
export async function patchInvoiceEmbeddedBarcodes(invoiceId: string, patches: NonNullable<Window["deliverStatusPatches"]>[number]["patches"]) {
  window.deliverStatusPatches = [...(window.deliverStatusPatches ?? []), { invoiceId, patches }];
  await new Promise(resolve => setTimeout(resolve, 50));
  if (window.deliverStatusPatches.length === window.deliverStatusFail) throw new Error("Status failed");
}
export async function saveInvoiceReceiverSignature(input: unknown) {
  window.deliverSignatureWrites = [...(window.deliverSignatureWrites ?? []), input];
  await new Promise(resolve => setTimeout(resolve, 100));
  if (window.deliverSignatureFail) throw new Error("Save failed");
}
export function normalizeApiError(error: unknown) { return { message: error instanceof Error ? error.message : "Error" }; }

export async function fetchBarcodeStatusOptions() {
  return [{ id: 4, name: "ALM-RD" }, { id: 7, name: "ENTREGADO" }];
}
export async function fetchActiveInvoicePolicies() {
  if (window.deliverPoliciesFail) throw new Error("Policies failed");
  return window.deliverNoPolicies ? [] : [{ id: 1, title: "Liability", body: "Inspect items on delivery.", sortOrder: 1, active: true }];
}
export const fetchAllInvoicePolicies = async () => [];
export const fetchInvoicePolicy = async () => null;
export const createInvoicePolicy = async () => null;
export const updateInvoicePolicy = async () => null;
export const deleteInvoicePolicy = async () => undefined;

export async function fetchInvoiceDocuments(_invoiceId: string, cursor?: string) {
  window.deliverDocumentReads = (window.deliverDocumentReads ?? 0) + 1;
  return cursor ? { items: ["delivery_10.mp4", ...(window.deliverDocumentSaved ?? [])].map(name => ({ name, originalName: name })) }
    : { items: [{ name: "delivery_2.jpg", originalName: "delivery_2.jpg" }], nextCursor: "page-2" };
}
export async function uploadInvoiceDocument(invoiceId: string, file: File, progress: (percent: number) => void) {
  if (invoiceId !== "invoice-1") throw new Error("Wrong invoice");
  window.deliverDocumentAttempts = [...(window.deliverDocumentAttempts ?? []), file.name];
  progress(50);
  await new Promise(resolve => setTimeout(resolve, 50));
  if (window.deliverDocumentAttempts.length === window.deliverDocumentFailAt) throw new Error("Upload failed");
  window.deliverDocumentSaved = [...(window.deliverDocumentSaved ?? []), file.name];
  return { id: file.name, name: file.name };
}
