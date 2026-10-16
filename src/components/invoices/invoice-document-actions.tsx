"use client";

import { FormKeyboardHint } from "@/components/forms/form-shell";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { invoiceDocumentNameSchema } from "@/lib/invoices/schemas/invoice-document.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InvoiceDocument } from "@/lib/invoices/documents";
import { useTranslation } from "@/lib/i18n";

type Props = {
  document: InvoiceDocument;
  mode: "rename" | "delete";
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
};
export function InvoiceDocumentActions({
  document,
  mode,
  pending,
  error,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(invoiceDocumentNameSchema(document.name)),
    defaultValues: { name: document.name },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`invoices.documents.${mode}`)}</DialogTitle>
          <DialogDescription>
            {mode === "delete"
              ? t("invoices.documents.deleteWarning", { name: document.name })
              : t("invoices.documents.renameHint")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async ({ name }) => {
            await onConfirm(name);
          })}
          className="space-y-4"
        >
          {mode === "rename" ? <FormKeyboardHint /> : null}
          {mode === "rename" ? (
            <div className="space-y-2">
              <Label htmlFor="document-name">
                {t("invoices.documents.name")}
              </Label>
              <Input
                id="document-name"
                {...register("name")}
                aria-invalid={Boolean(errors.name)}
                disabled={pending}
              />
              {errors.name ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("invoices.documents.invalidName")}
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              {t("invoices.documents.cancel")}
            </Button>
            <Button
              type="submit"
              variant={mode === "delete" ? "destructive" : "default"}
              disabled={pending}
            >
              {pending
                ? t("invoices.documents.saving")
                : t(`invoices.documents.${mode}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
