"use client";

import { Controller } from "react-hook-form";

import {
  ComplaintFieldError,
  ComplaintRequiredMark,
  ComplaintTargetsSection,
} from "@/components/complaints/complaint-targets-section";
import { FormBody, FormFooter } from "@/components/forms/form-shell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { useComplaintWorkflow } from "@/lib/complaints/hooks/use-complaint-workflow";
import { COMPLAINT_ATTACHMENT_MAX_MB } from "@/lib/complaints/schemas/complaint.schema";
import { COMPLAINT_ATTACHMENT_TYPES } from "@/lib/complaints/types";
import { useTranslation } from "@/lib/i18n";

type Workflow = ReturnType<typeof useComplaintWorkflow>;

export function ComplaintTargetsDialog({ workflow, canPickEmployees }: { workflow: Workflow; canPickEmployees: boolean }) {
  const { t } = useTranslation();
  return (
    <Dialog open={workflow.dialog === "targets"} onOpenChange={(open) => (open ? undefined : workflow.closeDialog())}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>{t("complaints.workflow.dialogs.targets.title")}</DialogTitle>
          <DialogDescription>{t("complaints.workflow.dialogs.targets.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={workflow.submitTargets} className="flex min-h-0 flex-1 flex-col">
          <FormBody isBusy={workflow.busy}>
            <ComplaintTargetsSection form={workflow.targetsForm} busy={workflow.busy} canPickEmployees={canPickEmployees} />
          </FormBody>
          <FormFooter
            error={workflow.dialogError}
            isSubmitting={workflow.busy}
            submitLabel={t("complaints.workflow.dialogs.targets.submit")}
            onCancel={workflow.closeDialog}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ComplaintAttachmentDialog({ workflow }: { workflow: Workflow }) {
  const { t } = useTranslation();
  const { errors } = workflow.attachmentForm.formState;
  const typeOptions = COMPLAINT_ATTACHMENT_TYPES.map((type) => ({
    value: type.mimeType,
    label: t(`complaints.attachments.types.${type.id}`),
    description: type.mimeType,
    keywords: [type.id, type.mimeType],
  }));

  return (
    <Dialog open={workflow.dialog === "attachment"} onOpenChange={(open) => (open ? undefined : workflow.closeDialog())}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>{t("complaints.workflow.dialogs.attachment.title")}</DialogTitle>
          <DialogDescription>{t("complaints.workflow.dialogs.attachment.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={workflow.submitAttachment} className="flex min-h-0 flex-1 flex-col">
          <FormBody isBusy={workflow.busy}>
            <div className="space-y-1">
              <Label htmlFor="complaint-attachment-url">
                {t("complaints.attachments.fileUrl")}
                <ComplaintRequiredMark />
              </Label>
              <Input
                id="complaint-attachment-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoFocus
                maxLength={2048}
                placeholder="https://"
                disabled={workflow.busy}
                aria-invalid={Boolean(errors.fileUrl)}
                {...workflow.attachmentForm.register("fileUrl")}
              />
              <ComplaintFieldError message={errors.fileUrl?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <div className="space-y-1">
                <Label htmlFor="complaint-attachment-type">
                  {t("complaints.attachments.mimeType")}
                  <ComplaintRequiredMark />
                </Label>
                <Controller
                  control={workflow.attachmentForm.control}
                  name="mimeType"
                  render={({ field }) => (
                    <SearchableSelect
                      id="complaint-attachment-type"
                      options={typeOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={workflow.busy}
                      aria-invalid={Boolean(errors.mimeType)}
                      placeholder={t("complaints.attachments.selectType")}
                      searchPlaceholder={t("complaints.form.searchOptions")}
                      emptyMessage={t("complaints.form.noOptions")}
                    />
                  )}
                />
                <ComplaintFieldError message={errors.mimeType?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="complaint-attachment-size">
                  {t("complaints.attachments.sizeMb")}
                  <ComplaintRequiredMark />
                </Label>
                <Input
                  id="complaint-attachment-size"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={COMPLAINT_ATTACHMENT_MAX_MB}
                  step="any"
                  disabled={workflow.busy}
                  aria-invalid={Boolean(errors.sizeMb)}
                  {...workflow.attachmentForm.register("sizeMb")}
                />
                <ComplaintFieldError message={errors.sizeMb?.message} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("complaints.attachments.hint")}</p>
          </FormBody>
          <FormFooter
            error={workflow.dialogError}
            isSubmitting={workflow.busy}
            submitLabel={t("complaints.workflow.dialogs.attachment.submit")}
            onCancel={workflow.closeDialog}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
