"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvoiceDocumentDraft } from "@/lib/invoices/hooks/use-invoice-document-draft";
import { uploadDeliveryDocuments } from "@/lib/invoices/api/delivery-documents-api";
import { normalizeApiError } from "@/lib/api/axios";
import { store } from "@/lib/store/store";
import { useTranslation } from "@/lib/i18n";

type Progress = { name: string; percent: number; done: boolean };

export function useDeliveryDocuments(invoiceId: string, companyId: string | null, enabled: boolean) {
  const { t } = useTranslation();
  const draft = useInvoiceDocumentDraft();
  const client = useQueryClient();
  const running = useRef(false);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (files: File[]) => {
      const token = store.getState().auth.idToken;
      const assertContext = () => {
        const context = store.getState().auth;
        if (!enabled || !companyId || companyId !== context.companyId || token !== context.idToken) {
          throw new Error(t("invoices.documents.accessDenied"));
        }
      };
      assertContext();
      try {
        await uploadDeliveryDocuments({
          invoiceId,
          companyId: companyId!,
          files,
          assertContext,
          onProgress: (_index, name, percent) => setProgress((current) => [
            ...current.filter((item) => item.name !== name),
            { name, percent, done: false },
          ]),
          onUploaded: (_index, name) => {
            // Remove only completed files. Failed and unattempted files remain queued.
            draft.remove(0);
            setProgress((current) => [
              ...current.filter((item) => item.name !== name),
              { name, percent: 100, done: true },
            ]);
          },
        });
      } finally {
        await client.invalidateQueries({ queryKey: ["invoice-documents", companyId, invoiceId] });
      }
    },
  });
  async function upload() {
    if (running.current || !enabled || !draft.files.length) return;
    running.current = true;
    setError(null);
    setProgress((current) => current.filter((item) => item.done));
    try {
      await mutation.mutateAsync([...draft.files]);
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    } finally {
      running.current = false;
      mutation.reset();
    }
  }
  return { ...draft, upload, progress, error, busy: mutation.isPending, hasPending: draft.files.length > 0 };
}
