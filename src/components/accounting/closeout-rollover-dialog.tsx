"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DailyIncomeStatementForm } from "./daily-income-statement-form";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCloseoutCalendar, useCreateIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeStatement, DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady?: (statement: DailyIncomeStatement) => void | Promise<void>;
};

function isRdBranch(code: string | undefined) {
  return code?.trim().toUpperCase() === "RD";
}

export function CloseoutRolloverDialog({ open, onOpenChange, onReady }: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const user = useCurrentUser();
  const branches = useBranchPicker(200, { enabled: open });
  const branch = branches.data?.items.find((item) => item.id === user.data?.branch.id);
  const calendar = useCloseoutCalendar(open ? user.data?.branch.id ?? 0 : 0);
  const create = useCreateIncomeStatement();
  const [retryError, setRetryError] = useState<string | null>(null);
  const autoCreateAttemptedRef = useRef(false);
  const initialValues = useMemo(
    () => ({
      date: calendar.data?.today ?? "",
      branchId: branch?.id ?? 0,
      branchCode: branch?.code ?? "",
      branchName: branch?.name ?? "",
      currency: "USD",
      rate: 1,
    }),
    [calendar.data?.today, branch?.id, branch?.code, branch?.name],
  );
  const canCreate = hasPermission("canCreateIncomeStatement", "income_statement");
  const needsExchangeRate = isRdBranch(branch?.code);
  const error =
    retryError ??
    (create.isError
      ? normalizeApiError(create.error).message
      : !canCreate
        ? t("accounting.dailyIncome.statement.createPermission")
        : null);
  const prerequisitesReady = Boolean(branch && calendar.data?.today && initialValues.branchId && initialValues.date);
  const loadingPrerequisites =
    open &&
    !prerequisitesReady &&
    (user.isLoading || branches.isLoading || calendar.isLoading);
  const prerequisiteError = user.isError
    ? normalizeApiError(user.error).message
    : branches.isError
      ? normalizeApiError(branches.error).message
      : calendar.isError
        ? normalizeApiError(calendar.error).message
        : null;
  /** Non-RD has nothing editable — create immediately and only surface UI on failure / RD rate entry. */
  const showDialog =
    open &&
    (needsExchangeRate ||
      Boolean(error) ||
      Boolean(prerequisiteError) ||
      !canCreate);

  async function submit(values: DailyIncomeStatementValues) {
    setRetryError(null);
    let statement: DailyIncomeStatement;
    try {
      statement = await create.mutateAsync(
        needsExchangeRate ? values : { ...values, currency: "USD", rate: 1 },
      );
    } catch {
      // Mutation state displays the creation error without resetting entered values.
      return;
    }
    try {
      await onReady?.(statement);
      onOpenChange(false);
    } catch (failure) {
      setRetryError(normalizeApiError(failure).message);
    }
  }

  useEffect(() => {
    if (!open) {
      autoCreateAttemptedRef.current = false;
      setRetryError(null);
      create.reset();
    }
    // Only reset when the dialog request closes — not when create identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create.reset is stable enough; avoid re-running on pending flips
  }, [open]);

  useEffect(() => {
    if (!open || needsExchangeRate || !canCreate || !prerequisitesReady) return;
    if (autoCreateAttemptedRef.current || create.isPending) return;

    autoCreateAttemptedRef.current = true;
    void submit(initialValues);
    // submit closes over latest values; re-run when prerequisites become ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    needsExchangeRate,
    canCreate,
    prerequisitesReady,
    initialValues.date,
    initialValues.branchId,
    create.isPending,
  ]);

  return (
    <Dialog open={showDialog} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("accounting.dailyIncome.statement.createTitle")}</DialogTitle>
          <DialogDescription>
            {t(
              needsExchangeRate
                ? "accounting.dailyIncome.statement.rolloverHelp"
                : "accounting.dailyIncome.statement.rolloverHelpDefault",
            )}
          </DialogDescription>
        </DialogHeader>
        {prerequisiteError ? (
          <div className="space-y-4">
            <FormFooterNoticeMessage tone="error" message={prerequisiteError} />
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.actions.cancel")}
              </Button>
            </div>
          </div>
        ) : loadingPrerequisites || !prerequisitesReady ? (
          <p role="status">{t("common.loading")}</p>
        ) : needsExchangeRate ? (
          <DailyIncomeStatementForm
            branches={[]}
            lockBranch
            initialValues={initialValues}
            disabled={!canCreate}
            isSubmitting={create.isPending}
            error={error}
            onCancel={() => onOpenChange(false)}
            onSubmit={submit}
          />
        ) : (
          <div className="space-y-4">
            {error ? <FormFooterNoticeMessage tone="error" message={error} /> : null}
            <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t bg-background py-4 sm:flex sm:justify-end">
              <Button type="button" variant="outline" className="min-w-0" onClick={() => onOpenChange(false)} disabled={create.isPending}>
                {t("common.actions.cancel")}
              </Button>
              {canCreate ? (
                <Button
                  type="button"
                  className="min-w-0 whitespace-normal"
                  disabled={create.isPending}
                  onClick={() => {
                    autoCreateAttemptedRef.current = true;
                    void submit(initialValues);
                  }}
                >
                  {create.isPending ? t("common.actions.saving") : t("accounting.dailyIncome.statement.save")}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
