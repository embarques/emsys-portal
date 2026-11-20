"use client";

import { MessageSquare, Save } from "lucide-react";
import type { FieldError as HookFieldError, UseFormRegisterReturn } from "react-hook-form";

import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { useComplaintWorkflow } from "@/lib/complaints/hooks/use-complaint-workflow";
import { useTranslation } from "@/lib/i18n";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

function TextareaField({
  id,
  label,
  registration,
  error,
  disabled,
  autoFocus,
  maxLength,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: HookFieldError;
  disabled: boolean;
  autoFocus?: boolean;
  maxLength: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        <span className="text-destructive"> *</span>
      </Label>
      <textarea
        id={id}
        rows={4}
        autoFocus={autoFocus}
        maxLength={maxLength}
        disabled={disabled}
        className={textareaClassName}
        aria-invalid={Boolean(error)}
        {...registration}
      />
      {error?.message ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error.message)}
        </p>
      ) : null}
    </div>
  );
}

/** Resolve, internal note and reopen commands; each needs free text the API validates. */
export function ComplaintActionDialog({ workflow }: { workflow: ReturnType<typeof useComplaintWorkflow> }) {
  const { t } = useTranslation();
  const kind = workflow.dialog === "resolve" || workflow.dialog === "note" || workflow.dialog === "reopen" ? workflow.dialog : null;
  const onSubmit =
    kind === "resolve" ? workflow.submitResolve : kind === "reopen" ? workflow.submitReopen : workflow.submitNote;

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => (open ? undefined : workflow.closeDialog())}>
      <CompactActionDialogContent className="sm:max-w-lg">
        <CompactActionDialogHeader
          icon={MessageSquare}
          title={kind ? t(`complaints.workflow.dialogs.${kind}.title`) : null}
          description={kind ? t(`complaints.workflow.dialogs.${kind}.description`) : null}
        />
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <CompactActionDialogBody className="space-y-4">
          {kind === "resolve" ? (
            <>
              <TextareaField
                id="complaint-resolution-summary"
                label={t("complaints.fields.resolutionSummary")}
                registration={workflow.resolveForm.register("summary")}
                error={workflow.resolveForm.formState.errors.summary}
                disabled={workflow.busy}
                maxLength={5000}
                autoFocus
              />
              <TextareaField
                id="complaint-resolution-action"
                label={t("complaints.fields.actionTaken")}
                registration={workflow.resolveForm.register("actionTaken")}
                error={workflow.resolveForm.formState.errors.actionTaken}
                disabled={workflow.busy}
                maxLength={5000}
              />
            </>
          ) : null}
          {kind === "note" ? (
            <TextareaField
              id="complaint-note-body"
              label={t("complaints.fields.note")}
              registration={workflow.noteForm.register("body")}
              error={workflow.noteForm.formState.errors.body}
              disabled={workflow.busy}
              maxLength={5000}
              autoFocus
            />
          ) : null}
          {kind === "reopen" ? (
            <TextareaField
              id="complaint-reopen-reason"
              label={t("complaints.fields.reopenReason")}
              registration={workflow.reopenForm.register("reason")}
              error={workflow.reopenForm.formState.errors.reason}
              disabled={workflow.busy}
              maxLength={1000}
              autoFocus
            />
          ) : null}
          </CompactActionDialogBody>
          <CompactActionDialogFooter
            error={workflow.dialogError}
            isSubmitting={workflow.busy}
            submitLabel={kind ? t(`complaints.workflow.dialogs.${kind}.submit`) : t("common.actions.save")}
            submitType="submit"
            submitIcon={<Save className="h-4 w-4" />}
            onCancel={workflow.closeDialog}
          />
        </form>
      </CompactActionDialogContent>
    </Dialog>
  );
}
