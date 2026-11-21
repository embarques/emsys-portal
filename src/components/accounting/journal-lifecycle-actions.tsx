"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { FilePenLine, NotebookPen } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { journalLifecycleSchema } from "@/lib/accounting/daily-income/schemas/journal-correction.schema";
import { useForm } from "react-hook-form";

import { RequestChangeButton } from "@/components/change-requests/request-change-button";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { createRandomId } from "@/lib/utils/id";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";
import { tableSelectionActionMenuStyles, tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { journalDeleteOperation } from "@/lib/accounting/daily-income/journal-editability";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useJournalLifecycle } from "@/lib/accounting/daily-income/lifecycle-hooks";

type Action = "reverse" | "void" | "note";

type JournalLifecycleActionsProps = {
  journal: DailyIncomeJournal;
  /** Sheet footer, compact toolbar buttons, or selection Actions menu items. */
  variant?: "sheet" | "toolbar" | "menu";
  /** Called after a successful void / reverse / note (e.g. clear table selection). */
  onCompleted?: () => void;
  hasEditAction?: boolean;
};

export function JournalLifecycleActions({
  journal,
  variant = "sheet",
  onCompleted,
  hasEditAction = false,
}: JournalLifecycleActionsProps) {
  const { t } = useTranslation();
  const { notifySuccess } = useFeedback();
  const { hasPermission } = useAuth();
  const { openFormTab } = useWorkspaceTabs();
  const text = (key: string) => t(`accounting.journalLifecycle.${key}`);
  const [action, setAction] = useState<Action | null>(null);
  const [requestId, setRequestId] = useState(createRandomId);
  const mutation = useJournalLifecycle();
  const form = useForm<{ reason: string; description: string }>({
    resolver: zodResolver(journalLifecycleSchema(action === "note")),
    defaultValues: { reason: "", description: journal.description },
  });
  const reasonId = useId();
  const submitting = useRef(false);
  const deleteOperation = journalDeleteOperation(journal);
  const actions = journal.allowedActions;
  const showLifecycle = Boolean(actions && journal.version);
  const canRequest = hasPermission("canCreateChangeRequest", "change_request");
  if (!showLifecycle && !canRequest) return null;

  function edit() {
    openFormTab({ feature: "daily-income-transactions", baseHref: "/accounting/daily-income", mode: "edit", entityId: journal.id, label: t("common.actions.edit") });
  }

  const size = variant === "toolbar" ? "sm" : "default";
  const buttonClass = variant === "toolbar" ? "whitespace-nowrap" : undefined;

  function open(next: Action) {
    setAction(next);
    setRequestId(createRandomId());
    form.reset({ reason: "", description: journal.description });
    mutation.reset();
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => form.handleSubmit((values) => {
    if (!action || !journal.version || submitting.current) return;
    if (action === "note" && values.description === journal.description) {
      notifySuccess(t("common.form.noChanges"));
      setAction(null);
      return;
    }
    submitting.current = true;
    mutation.mutate(
      {
        id: journal.id,
        action,
        requestId,
        expectedVersion: journal.version,
        invoiceId: journal.invoice?.id ? String(journal.invoice.id) : undefined,
        ...values,
      },
      {
        onSettled: () => { submitting.current = false; },
        onSuccess: () => {
          setAction(null);
          onCompleted?.();
        },
      },
    );
  })(event);

  const dialog = (
    <Dialog
        open={Boolean(action)}
        onOpenChange={(openState) => {
          if (!openState && !mutation.isPending) setAction(null);
        }}
      >
        <CompactActionDialogContent>
          <CompactActionDialogHeader
            icon={NotebookPen}
            title={action === "note" || !action ? text("note") : t("common.actions.delete")}
            description={text(action === "note" ? "noteDescription" : action === "void" ? "voidDescription" : "reverseDescription")}
          />
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onChange={() => {
              if (!mutation.isPending) setRequestId(createRandomId());
            }}
          >
            <CompactActionDialogBody className="space-y-4">
            {action === "note" ? (
              <>
                <Label htmlFor={reasonId}>{text("description")}</Label>
                <textarea
                  id={reasonId}
                  className="min-h-24 w-full rounded-md border bg-background p-3"
                  {...form.register("description")}
                  aria-invalid={Boolean(form.formState.errors.description)}
                  aria-describedby={form.formState.errors.description ? `${reasonId}-error` : undefined}
                  disabled={mutation.isPending}
                />
                {journal.restrictionReason ? (
                  <p className="text-sm text-muted-foreground">{journal.restrictionReason}</p>
                ) : null}
              </>
            ) : (
              <>
                <Label htmlFor={reasonId}>{text("reason")}</Label>
                <textarea
                  id={reasonId}
                  className="min-h-24 w-full rounded-md border bg-background p-3"
                  {...form.register("reason")}
                  required
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  aria-describedby={form.formState.errors.reason ? `${reasonId}-error` : undefined}
                  disabled={mutation.isPending}
                />
              </>
            )}
            {form.formState.errors[action === "note" ? "description" : "reason"] ? (
              <p id={`${reasonId}-error`} role="alert">{t(form.formState.errors[action === "note" ? "description" : "reason"]!.message!)}</p>
            ) : null}
            {mutation.isError ? (
              <p role="alert">{normalizeApiError(mutation.error).message}</p>
            ) : null}
            </CompactActionDialogBody>
            <CompactActionDialogFooter
              onCancel={() => setAction(null)}
              cancelDisabled={mutation.isPending}
              submitLabel={text("confirm")}
              submitType="submit"
              isSubmitting={mutation.isPending}
            />
          </form>
        </CompactActionDialogContent>
      </Dialog>
  );

  if (variant === "menu") {
    return (
      <>
        {canRequest ? (
          <DropdownMenuItem asChild className={tableSelectionActionMenuStyles.request}>
            <Link href={changeRequestHref("journal", journal.id)}>
              <FilePenLine className="size-4" />
              {text("request")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showLifecycle && deleteOperation ? (
          <DropdownMenuItem onSelect={() => open(deleteOperation)} className={tableSelectionActionMenuStyles.delete}>
            {t("common.actions.delete")}
          </DropdownMenuItem>
        ) : null}
        {showLifecycle && actions?.correct && !hasEditAction ? (
          <DropdownMenuItem onSelect={edit} className={tableSelectionActionMenuStyles.request}>
            {t("common.actions.edit")}
          </DropdownMenuItem>
        ) : null}
        {showLifecycle && actions?.note ? (
          <DropdownMenuItem onSelect={() => open("note")} className={tableSelectionActionMenuStyles.note}>
            {text("note")}
          </DropdownMenuItem>
        ) : null}
        {dialog}
      </>
    );
  }

  const buttons = (
    <>
      {canRequest ? (
        <RequestChangeButton
          resourceType="journal"
          resourceId={journal.id}
          size={size}
          className={buttonClass}
        />
      ) : null}
      {showLifecycle && deleteOperation ? (
        <Button type="button" variant="outline" size={size} className={cn(buttonClass, tableSelectionActionStyles.delete)} onClick={() => open(deleteOperation)}>
          {t("common.actions.delete")}
        </Button>
      ) : null}
      {showLifecycle && actions?.correct && !hasEditAction ? (
        <Button type="button" variant="outline" size={size} className={buttonClass} onClick={edit}>
          {t("common.actions.edit")}
        </Button>
      ) : null}
      {showLifecycle && actions?.note ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn(buttonClass, tableSelectionActionStyles.note)}
          onClick={() => open("note")}
        >
          {text("note")}
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <div
        className={
          variant === "toolbar"
            ? "flex flex-wrap items-center justify-end gap-1.5"
            : "flex flex-wrap gap-2 border-t px-6 py-4"
        }
      >
        {buttons}
        {variant === "sheet" && journal.restrictionReason ? (
          <p className="w-full text-sm text-muted-foreground">{journal.restrictionReason}</p>
        ) : null}
      </div>
      {dialog}
    </>
  );
}
