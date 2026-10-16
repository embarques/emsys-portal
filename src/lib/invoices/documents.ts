export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  "";

export type DocumentActor = {
  name?: string;
  fullName?: string;
  userName?: string;
  email?: string;
};

export function documentActorName(actor?: DocumentActor): string {
  return (
    actor?.name || actor?.fullName || actor?.userName || actor?.email || "—"
  );
}

export type InvoiceDocument = {
  id: string;
  invoiceId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  version: number;
  deleting: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: DocumentActor;
  updatedBy?: DocumentActor;
};
export type DocumentPage = { items: InvoiceDocument[]; nextCursor?: string };
export type DocumentLink = { url: string; expiresAt: string; mimeType: string };
export type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "failed";
  error?: string;
};

export function canPreviewDocument(mimeType: string): boolean {
  return mimeType.startsWith("video/") || mimeType.startsWith("audio/") || [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
  ].includes(mimeType);
}
export function formatDocumentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function sortDocuments(
  items: InvoiceDocument[],
  search: string,
  sort: "newest" | "name",
) {
  const query = search.trim().toLocaleLowerCase();
  return items
    .filter((item) => item.name.toLocaleLowerCase().includes(query))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
}
