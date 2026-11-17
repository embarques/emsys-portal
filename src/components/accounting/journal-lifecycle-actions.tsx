"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { RequestChangeButton } from "@/components/change-requests/request-change-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { createRandomId } from "@/lib/utils/id";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { useJournalLifecycle } from "@/lib/accounting/daily-income/lifecycle-hooks";

type Action = "reverse" | "void" | "note";

type JournalLifecycleActionsProps = {
  journal: DailyIncomeJournal;
  /** Sheet footer vs compact selection-toolbar buttons. */
  variant?: "sheet" | "toolbar";
  /** Called after a successful void / reverse / note (e.g. clear table selection). */
  onCompleted?: () => void;
};

export function JournalLifecycleActions({
  journal,
  variant = "sheet",
  onCompleted,
}: JournalLifecycleActionsProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const text = (key: string) => t(`accounting.journalLifecycle.${key}`);
  const [action, setAction] = useState<Action | null>(null);
  const [requestId, setRequestId] = useState(createRandomId);
  const mutation = useJournalLifecycle();
  const form = useForm<{ reason: string; description: string }>({
    defaultValues: { reason: "", description: journal.description },
  });
  const actions = journal.allowedActions;
  const isRouteOperator =
    hasPermission("canOperateDailyRoute", "daily_route_work") &&
    !hasPermission("canManageDailyRouteRecords", "daily_route_work");
  const showLifecycle = Boolean(actions && journal.version && !isRouteOperator);
  const canRequest = hasPermission("canCreateChangeRequest", "change_request");
  if (!showLifecycle && !canRequest) return null;

  const size = variant === "toolbar" ? "sm" : "default";
  const buttonClass = variant === "toolbar" ? "whitespace-nowrap" : undefined;

  function open(next: Action) {
    setAction(next);
    setRequestId(createRandomId());
    form.reset({ reason: "", description: journal.description });
    mutation.reset();
  }

  const submit = form.handleSubmit((values) => {
    if (!action || !journal.version) return;
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
        onSuccess: () => {
          setAction(null);
          onCompleted?.();
        },
      },
    );
  });

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
      {showLifecycle && actions?.void ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={buttonClass}
          onClick={() => open("void")}
        >
          {text("void")}
        </Button>
      ) : null}
      {showLifecycle && actions?.reverse ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={buttonClass}
          onClick={() => open("reverse")}
        >
          {text("reverse")}
        </Button>
      ) : null}
      {showLifecycle && actions?.correct && canRequest ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn(buttonClass, variant === "toolbar" && tableSelectionActionStyles.request)}
          asChild
        >
          <Link
            href={`/change-requests?${new URLSearchParams({
              resourceType: "journal",
              resourceId: journal.id,
              action: "UPDATE",
            })}`}
          >
            {text("correct")}
          </Link>
        </Button>
      ) : null}
      {showLifecycle && actions?.note ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={buttonClass}
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
      <Dialog
        open={Boolean(action)}
        onOpenChange={(openState) => {
          if (!openState && !mutation.isPending) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text(action ?? "note")}</DialogTitle>
            <DialogDescription>
              {text(action === "note" ? "noteDescription" : "warning")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={submit}
            className="space-y-4"
            onChange={() => {
              if (!mutation.isPending) setRequestId(createRandomId());
            }}
          >
            {action === "note" ? (
              <>
                <Label htmlFor="journal-note">{text("description")}</Label>
                <textarea
                  id="journal-note"
                  className="min-h-24 w-full rounded-md border bg-background p-3"
                  {...form.register("description", { maxLength: 2000 })}
                  disabled={mutation.isPending}
                />
                {journal.restrictionReason ? (
                  <p className="text-sm text-muted-foreground">{journal.restrictionReason}</p>
                ) : null}
              </>
            ) : (
              <>
                <Label htmlFor="journal-reversal-reason">{text("reason")}</Label>
                <textarea
                  id="journal-reversal-reason"
                  className="min-h-24 w-full rounded-md border bg-background p-3"
                  {...form.register("reason", {
                    required: true,
                    validate: (value) => Boolean(value.trim()),
                    maxLength: 1000,
                  })}
                  disabled={mutation.isPending}
                />
              </>
            )}
            {mutation.isError ? (
              <p role="alert">{normalizeApiError(mutation.error).message}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setAction(null)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {text("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
