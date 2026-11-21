"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotebookPen } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CompactActionDialogBody, CompactActionDialogContent, CompactActionDialogFooter, CompactActionDialogHeader } from "@/components/forms/compact-action-dialog";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { journalCorrectionReasonSchema } from "@/lib/accounting/daily-income/schemas/journal-correction.schema";
import type { useJournalEdit } from "@/lib/accounting/daily-income/use-journal-edit";

export function JournalCorrectionDialog({ workflow }: { workflow: ReturnType<typeof useJournalEdit> }) {
  const { t } = useTranslation();
  const id = useId();
  const form = useForm({ resolver: zodResolver(journalCorrectionReasonSchema), defaultValues: { reason: "" } });
  return <Dialog open={Boolean(workflow.pending)} onOpenChange={open => { if (!open) workflow.cancel(); }}>
    <CompactActionDialogContent onCloseAutoFocus={() => form.reset()}>
      <CompactActionDialogHeader icon={NotebookPen} title={t("common.actions.edit")} description={t("accounting.journalLifecycle.correctDescription")} />
      <form noValidate onSubmit={form.handleSubmit(values => workflow.confirm(values.reason))} className="flex min-h-0 flex-1 flex-col">
        <CompactActionDialogBody className="space-y-3">
          <Label htmlFor={id}>{t("accounting.journalLifecycle.reason")}</Label>
          <textarea required id={id} {...form.register("reason")} disabled={workflow.isConfirming} aria-invalid={Boolean(form.formState.errors.reason)} aria-describedby={form.formState.errors.reason ? `${id}-error` : undefined} className="min-h-24 w-full rounded-md border bg-background p-3" />
          {form.formState.errors.reason ? <p id={`${id}-error`} role="alert">{t(form.formState.errors.reason.message!)}</p> : null}
          {workflow.error ? <p role="alert">{normalizeApiError(workflow.error).message}</p> : null}
        </CompactActionDialogBody>
        <CompactActionDialogFooter onCancel={workflow.cancel} submitType="submit" submitLabel={t("accounting.journalLifecycle.confirm")} isSubmitting={workflow.isConfirming} />
      </form>
    </CompactActionDialogContent>
  </Dialog>;
}
