import { axiosInstance } from "@/lib/api/axios";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type {
  DocumentLink,
  DocumentPage,
  InvoiceDocument,
} from "@/lib/invoices/documents";

type Envelope<T> = { success: boolean; data: T; message?: string };
const path = (invoiceId: string) =>
  `${API_ENDPOINTS.INVOICES}/${encodeURIComponent(invoiceId)}/documents`;
function unwrap<T>(payload: Envelope<T>): T {
  if (!payload.success)
    throw new Error(payload.message || "Document request failed");
  return payload.data;
}
export async function fetchInvoiceDocuments(
  invoiceId: string,
  cursor?: string,
): Promise<DocumentPage> {
  const response = await axiosInstance.get<Envelope<DocumentPage | null>>(
    path(invoiceId),
    { params: { cursor } },
  );
  const page = unwrap(response.data);
  return {
    items: Array.isArray(page?.items) ? page.items : [],
    nextCursor: page?.nextCursor || undefined,
  };
}
export async function uploadInvoiceDocument(
  invoiceId: string,
  file: File,
  progress: (percent: number) => void,
  uploadId?: string,
): Promise<InvoiceDocument> {
  const form = new FormData();
  form.append("file", file);
  if (uploadId) form.append("uploadId", uploadId);
  const response = await axiosInstance.post<Envelope<InvoiceDocument>>(
    path(invoiceId),
    form,
    {
      headers: { "Content-Type": undefined },
      timeout: 180_000,
      useDirectApi: true,
      onUploadProgress: (event) =>
        progress(
          Math.min(
            99,
            Math.round((event.loaded * 100) / (event.total || file.size)),
          ),
        ),
    },
  );
  return unwrap(response.data);
}
export async function fetchInvoiceDocumentLink(
  invoiceId: string,
  documentId: string,
  download = false,
): Promise<DocumentLink> {
  const response = await axiosInstance.get<Envelope<DocumentLink>>(
    `${path(invoiceId)}/${documentId}/link`,
    { params: { download } },
  );
  return unwrap(response.data);
}
export async function renameInvoiceDocument(
  invoiceId: string,
  document: InvoiceDocument,
  name: string,
) {
  const response = await axiosInstance.patch<Envelope<InvoiceDocument>>(
    `${path(invoiceId)}/${document.id}`,
    { name },
    { headers: { "If-Match": String(document.version) } },
  );
  return unwrap(response.data);
}
export async function deleteInvoiceDocument(
  invoiceId: string,
  document: InvoiceDocument,
) {
  const response = await axiosInstance.delete<Envelope<null>>(
    `${path(invoiceId)}/${document.id}`,
    { headers: { "If-Match": String(document.version) } },
  );
  unwrap(response.data);
}
