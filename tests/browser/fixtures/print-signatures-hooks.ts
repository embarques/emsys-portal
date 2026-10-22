import { useMutation } from "@tanstack/react-query";
import type { ReportRequest } from "@/lib/reports/types";
declare global {
 interface Window {
  visual?: boolean; readOnly?: boolean; failPrint?: boolean; failMetadata?: boolean; trip?: boolean;
  printRequests?: ReportRequest[]; metadataRequests?: number; opened?: string; printClosed?: boolean;
 }
}
export const state = { auth: { companyId: "company-1", idToken: "session-1" } };
export const store = { getState: () => state };
export function useAppSelector<T>(select: (value: typeof state) => T) { return select(state); }
export function useAuth() { return { isAuthenticated: true, user: { uid: "driver-1" }, email: "driver@example.test", hasPermission: () => !window.readOnly }; }
export function useFeedback() { return { notifySuccess: () => {} }; }
export function normalizeApiError(error: unknown) { return { message: error instanceof Error ? error.message : "Error" }; }
export function useGenerateInvoiceReport() { return useMutation({ mutationFn: async (request: ReportRequest) => {
 const w = window; w.printRequests = [...(w.printRequests ?? []), request];
 await new Promise(resolve => setTimeout(resolve, 100));
 if (w.failPrint) throw new Error("Print failed");
 return { url: "/fixture.pdf" };
} }); }
export function openInvoiceReportUrl(url: string) { window.opened = url; }
export const apiClient = { post: async (_path: string, body: {invoiceIds: string[]}) => {
 const w = window; w.metadataRequests = (w.metadataRequests ?? 0) + 1;
 if (w.failMetadata) throw new Error("Metadata failed");
 return { success: true, data: body.invoiceIds.map((id, i) => ({ invoiceId:id, invoiceNumber:`INV-${i + 1}`, senderSignature: {signerName:"Sender"}, receiverSignatures: [
 {id:"68f800000000000000000005", deliveryId:5, signerName:"Delivery five", signedAt:"2026-10-21T10:00:00Z"},
 {id:"68f800000000000000000006", deliveryId:6, signerName:"Delivery six", signedAt:"2026-10-22T10:00:00Z"}
 ] })) };
} };
