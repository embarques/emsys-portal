"use client";

import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadInvoiceDocument } from "@/lib/invoices/api/invoice-documents-api";
import { MAX_DOCUMENT_BYTES } from "@/lib/invoices/documents";
import { normalizeApiError } from "@/lib/api/axios";
import { store } from "@/lib/store/store";
import { useTranslation } from "@/lib/i18n";

export type DeliveryPhoto = {
  id: string;
  file: File;
  percent: number;
  status: "ready" | "uploading" | "uploaded" | "failed";
  documentId?: string;
  error?: string;
};
const imageName = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|avif)$/i;
export function useDeliveryPhotos(
  invoiceId: string,
  deliveryId: string,
  companyId: string | null,
  requestId: string,
) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const running = useRef(false);
  const form = useForm<{ photos: DeliveryPhoto[] }>({
    defaultValues: { photos: [] },
  });
  const photos = useWatch({ control: form.control, name: "photos" });
  const patch = (id: string, update: Partial<DeliveryPhoto>) =>
    form.setValue(
      "photos",
      form
        .getValues("photos")
        .map((photo) => (photo.id === id ? { ...photo, ...update } : photo)),
    );
  const mutation = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const token = store.getState().auth.idToken;
      const assertContext = () => {
        const auth = store.getState().auth;
        if (
          !companyId ||
          companyId !== auth.companyId ||
          token !== auth.idToken
        )
          throw new Error(t("deliveries.deliver.unavailable"));
      };
      assertContext();
      for (const photo of form.getValues("photos")) {
        if (photo.status === "uploaded") continue;
        assertContext();
        patch(photo.id, { status: "uploading", percent: 0, error: undefined });
        try {
          const extension = /\.[^.\/\\]+$/.exec(photo.file.name)?.[0] ?? ".jpg";
          const file = new File(
            [photo.file],
            `delivery_${deliveryId}_${requestId}_${photo.id}${extension}`,
            { type: photo.file.type },
          );
          const document = await uploadInvoiceDocument(
            invoiceId,
            file,
            (percent) => patch(photo.id, { percent }),
            photo.id,
          );
          assertContext();
          if (!document.id) throw new Error(t("deliveries.wizard.photoFailed"));
          patch(photo.id, {
            status: "uploaded",
            percent: 100,
            documentId: document.id,
          });
        } catch (error) {
          patch(photo.id, {
            status: "failed",
            error: normalizeApiError(error).message,
          });
          throw error;
        }
      }
      await client.invalidateQueries({
        queryKey: ["invoice-documents", companyId, invoiceId],
      });
      return form.getValues("photos").map((photo) => photo.documentId!);
    },
  });
  function add(files: File[]) {
    if (running.current) return;
    const existing = form.getValues("photos");
    if (
      existing.length + files.length > 12 ||
      files.some(
        (file) =>
          !file.size ||
          file.size > MAX_DOCUMENT_BYTES ||
          (!file.type.startsWith("image/") && !imageName.test(file.name)),
      )
    ) {
      form.setError("root", { message: t("deliveries.wizard.photoLimits") });
      return;
    }
    form.clearErrors("root");
    form.setValue("photos", [
      ...existing,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        percent: 0,
        status: "ready" as const,
      })),
    ]);
  }
  function remove(id: string) {
    if (!running.current)
      form.setValue(
        "photos",
        form.getValues("photos").filter((photo) => photo.id !== id),
      );
  }
  async function upload() {
    if (running.current) return null;
    if (!form.getValues("photos").length) {
      form.clearErrors("root");
      return [];
    }
    running.current = true;
    form.clearErrors("root");
    try {
      return await mutation.mutateAsync();
    } catch (error) {
      form.setError("root", { message: normalizeApiError(error).message });
      return null;
    } finally {
      running.current = false;
      mutation.reset();
    }
  }
  return {
    photos,
    add,
    remove,
    upload,
    busy: mutation.isPending,
    error: form.formState.errors.root?.message,
    documentIds: photos
      .filter((photo) => photo.status === "uploaded")
      .map((photo) => photo.documentId!),
    hasPending: photos.some((photo) => photo.status !== "uploaded"),
  };
}
