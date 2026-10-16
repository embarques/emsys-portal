"use client";

import { useCallback, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import {
  deleteInvoiceDocument,
  fetchInvoiceDocumentLink,
  fetchInvoiceDocuments,
  renameInvoiceDocument,
  uploadInvoiceDocument,
} from "@/lib/invoices/api/invoice-documents-api";
import {
  MAX_DOCUMENT_BYTES,
  type InvoiceDocument,
  type UploadItem,
} from "@/lib/invoices/documents";

export function useInvoiceDocuments(invoiceId: string) {
  const companyId = useAppSelector((state) => state.auth.companyId);
  const client = useQueryClient();
  const key = ["invoice-documents", companyId, invoiceId];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchInvoiceDocuments(invoiceId, pageParam),
    getNextPageParam: (page) => page.nextCursor || undefined,
    enabled: Boolean(invoiceId && companyId),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: key });
  const rename = useMutation({
    mutationFn: ({
      document,
      name,
    }: {
      document: InvoiceDocument;
      name: string;
    }) => renameInvoiceDocument(invoiceId, document, name),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (document: InvoiceDocument) =>
      deleteInvoiceDocument(invoiceId, document),
    onSettled: invalidate,
  });
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const running = useRef(false);
  const batchSequence = useRef(0);
  const [uploading, setUploading] = useState(false);
  const upload = useCallback(
    async (files: File[], retryJob?: UploadItem) => {
      if (running.current || files.length === 0) return;
      running.current = true;
      setUploading(true);
      const batch = ++batchSequence.current;
      const jobs: UploadItem[] = files.map((file, index) => ({
        id: retryJob?.id ?? `${batch}-${index}`,
        file,
        progress: 0,
        status: "pending",
      }));
      setUploads((current) =>
        retryJob
          ? current.map((item) => (item.id === retryJob.id ? jobs[0] : item))
          : [...current.filter((item) => item.status === "failed"), ...jobs],
      );
      const update = (id: string, patch: Partial<UploadItem>) =>
        setUploads((items) =>
          items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
      // Two workers bound memory, bandwidth and simultaneous API requests.
      const queue = [...jobs];
      const worker = async () => {
        while (queue.length) {
          const job = queue.shift()!;
          if (job.file.size === 0 || job.file.size > MAX_DOCUMENT_BYTES) {
            update(job.id, { status: "failed", error: "size" });
            continue;
          }
          update(job.id, { status: "uploading" });
          try {
            await uploadInvoiceDocument(invoiceId, job.file, (progress) =>
              update(job.id, { progress }),
            );
            update(job.id, { status: "done", progress: 100 });
            await client.invalidateQueries({
              queryKey: ["invoice-documents", companyId, invoiceId],
            });
          } catch (error) {
            update(job.id, {
              status: "failed",
              error:
                error && typeof error === "object" && "message" in error
                  ? String(error.message)
                  : String(error),
            });
          }
        }
      };
      try {
        await Promise.all([worker(), worker()]);
      } finally {
        running.current = false;
        setUploading(false);
      }
    },
    [client, companyId, invoiceId],
  );
  return {
    query,
    documents: query.data?.pages.flatMap((page) => page.items) ?? [],
    rename,
    remove,
    upload,
    uploads,
    uploading,
  };
}

export function useInvoiceDocumentLink(
  invoiceId: string,
  document: InvoiceDocument | null,
) {
  const companyId = useAppSelector((state) => state.auth.companyId);
  return useQuery({
    queryKey: [
      "invoice-document-link",
      companyId,
      invoiceId,
      document?.id,
      document?.version,
    ],
    queryFn: () => fetchInvoiceDocumentLink(invoiceId, document!.id),
    enabled: Boolean(document && !document.deleting),
    staleTime: 180_000,
    refetchInterval: document ? 240_000 : false,
    gcTime: 0,
  });
}

export async function downloadDocument(
  invoiceId: string,
  document: InvoiceDocument,
) {
  // Open synchronously so browsers do not block the eventual signed-URL navigation.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const link = await fetchInvoiceDocumentLink(invoiceId, document.id, true);
    if (tab) tab.location.href = link.url;
    else window.location.assign(link.url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
