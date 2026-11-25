"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { classifyApiError } from "@/lib/api/api-error";
import { formatUserErrorMessage } from "@/lib/errors";
import { useComplaintMutations } from "@/lib/complaints/hooks/use-complaints";
import {
  complaintAttachmentFormSchema,
  complaintNoteFormSchema,
  complaintReopenFormSchema,
  complaintResolveFormSchema,
  complaintTargetsFormSchema,
} from "@/lib/complaints/schemas/complaint.schema";
import type {
  Complaint,
  ComplaintAttachmentFormValues,
  ComplaintSeverity,
  ComplaintStatus,
  ComplaintTargetsFormValues,
} from "@/lib/complaints/types";
import {
  buildComplaintAttachmentRequest,
  buildComplaintTargets,
  complaintTargetsToFormValues,
} from "@/lib/complaints/utils/intake";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useTranslation } from "@/lib/i18n";

export type ComplaintActionDialogKind = "resolve" | "note" | "reopen" | "targets" | "attachment";

const EMPTY_ATTACHMENT: ComplaintAttachmentFormValues = { fileUrl: "", mimeType: "", sizeMb: "" };

export function useComplaintWorkflow(complaint: Complaint | null) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const mutations = useComplaintMutations();
  const [dialog, setDialog] = useState<ComplaintActionDialogKind | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const resolveForm = useForm<{ summary: string; actionTaken: string }>({
    resolver: zodResolver(complaintResolveFormSchema),
    defaultValues: { summary: "", actionTaken: "" },
  });
  const noteForm = useForm<{ body: string }>({
    resolver: zodResolver(complaintNoteFormSchema),
    defaultValues: { body: "" },
  });
  const reopenForm = useForm<{ reason: string }>({
    resolver: zodResolver(complaintReopenFormSchema),
    defaultValues: { reason: "" },
  });
  const targetsForm = useForm<ComplaintTargetsFormValues>({
    resolver: zodResolver(complaintTargetsFormSchema),
    defaultValues: { targets: [] },
  });
  const attachmentForm = useForm<ComplaintAttachmentFormValues>({
    resolver: zodResolver(complaintAttachmentFormSchema),
    defaultValues: EMPTY_ATTACHMENT,
  });
  const busy =
    mutations.patch.isPending ||
    mutations.note.isPending ||
    mutations.reopen.isPending ||
    mutations.targets.isPending ||
    mutations.attachment.isPending;

  function errorMessage(cause: unknown) {
    const { status } = classifyApiError(cause);
    if (status === 412 || status === 428) return t("complaints.errors.versionConflict");
    if (status === 409) return t("complaints.errors.closedConflict");
    return formatUserErrorMessage(cause, t);
  }

  /** Runs one versioned command; errors go to the open dialog, otherwise to a toast. */
  async function run(command: (current: Complaint) => Promise<Complaint>, successKey: string): Promise<boolean> {
    if (!complaint || busy) return false;
    setDialogError(null);
    try {
      await command(complaint);
      feedback.notifySuccess(t(successKey));
      return true;
    } catch (cause) {
      if (dialog) setDialogError(errorMessage(cause));
      else feedback.notifyError(errorMessage(cause));
      return false;
    }
  }

  function transition(status: ComplaintStatus) {
    if (status === "rejected" && !window.confirm(t("complaints.workflow.confirmReject"))) return;
    void run(
      (current) => mutations.patch.mutateAsync({ complaint: current, patch: { status } }),
      `complaints.workflow.success.${status}`,
    );
  }

  function assign(assigneeId: number) {
    if (!complaint || assigneeId === complaint.assigneeId) return;
    void run(
      (current) => mutations.patch.mutateAsync({ complaint: current, patch: { assigneeId } }),
      assigneeId ? "complaints.workflow.success.assigned" : "complaints.workflow.success.unassigned",
    );
  }

  function changeSeverity(severity: ComplaintSeverity) {
    if (!complaint || severity === complaint.severity) return;
    void run(
      (current) => mutations.patch.mutateAsync({ complaint: current, patch: { severity } }),
      "complaints.workflow.success.severity",
    );
  }

  function openDialog(kind: ComplaintActionDialogKind) {
    resolveForm.reset({ summary: "", actionTaken: "" });
    noteForm.reset({ body: "" });
    reopenForm.reset({ reason: "" });
    targetsForm.reset({ targets: complaint ? complaintTargetsToFormValues(complaint.targets) : [] });
    attachmentForm.reset(EMPTY_ATTACHMENT);
    setDialogError(null);
    setDialog(kind);
  }

  async function finish(ok: boolean) {
    if (ok) setDialog(null);
  }

  const submitResolve = resolveForm.handleSubmit(async (values) =>
    finish(await run(
      (current) => mutations.patch.mutateAsync({
        complaint: current,
        patch: { status: "resolved", resolution: { summary: values.summary.trim(), actionTaken: values.actionTaken.trim() } },
      }),
      "complaints.workflow.success.resolved",
    )),
  );

  const submitNote = noteForm.handleSubmit(async (values) =>
    finish(await run(
      (current) => mutations.note.mutateAsync({ complaint: current, body: values.body.trim() }),
      "complaints.workflow.success.note",
    )),
  );

  const submitReopen = reopenForm.handleSubmit(async (values) =>
    finish(await run(
      (current) => mutations.reopen.mutateAsync({ complaint: current, reason: values.reason.trim() }),
      "complaints.workflow.success.reopened",
    )),
  );

  const submitTargets = targetsForm.handleSubmit(async (values) => {
    if (!complaint) return;
    const targets = buildComplaintTargets(values.targets);
    if (areFormValuesEquivalent(targets, buildComplaintTargets(complaintTargetsToFormValues(complaint.targets)))) {
      feedback.notifySuccess(t("common.form.noChanges"));
      setDialog(null);
      return;
    }
    await finish(await run(
      (current) => mutations.targets.mutateAsync({ complaint: current, targets }),
      "complaints.workflow.success.targets",
    ));
  });

  const submitAttachment = attachmentForm.handleSubmit(async (values) =>
    finish(await run(
      (current) => mutations.attachment.mutateAsync({ complaint: current, attachment: buildComplaintAttachmentRequest(values) }),
      "complaints.workflow.success.attachment",
    )),
  );

  return {
    busy,
    dialog,
    dialogError,
    resolveForm,
    noteForm,
    reopenForm,
    targetsForm,
    attachmentForm,
    submitTargets,
    submitAttachment,
    transition,
    assign,
    changeSeverity,
    openDialog,
    closeDialog: () => {
      if (!busy) setDialog(null);
    },
    submitResolve,
    submitNote,
    submitReopen,
  };
}
