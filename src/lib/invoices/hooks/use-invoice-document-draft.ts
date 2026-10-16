"use client";

import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { MAX_DOCUMENT_BYTES } from "@/lib/invoices/documents";

const fileSchema = z.custom<File>((file) =>
  typeof File !== "undefined" && file instanceof File &&
  file.size > 0 && file.size <= MAX_DOCUMENT_BYTES,
);

/** Files remain local until the invoice has a persisted ID. */
export function useInvoiceDocumentDraft() {
  const form = useForm<{ files: File[] }>({ defaultValues: { files: [] } });
  const files = useWatch({ control: form.control, name: "files" });
  return {
    files,
    invalid: Boolean(form.formState.errors.files),
    add: (selected: File[]) => {
      const valid = selected.filter((file) => fileSchema.safeParse(file).success);
      form.setValue("files", [...form.getValues("files"), ...valid]);
      if (valid.length !== selected.length) form.setError("files", { type: "size" });
      else form.clearErrors("files");
    },
    remove: (index: number) => form.setValue("files", form.getValues("files").filter((_, i) => i !== index)),
    reset: () => form.reset({ files: [] }),
  };
}
