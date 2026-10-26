"use client";

import { useMemo, useState } from "react";

import { DailyIncomeStatementForm } from "./daily-income-statement-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCloseoutCalendar, useCreateIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeStatement, DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady?: (statement: DailyIncomeStatement) => void | Promise<void>;
};

export function CloseoutRolloverDialog({ open, onOpenChange, onReady }: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const user = useCurrentUser();
  const branch = user.data?.branch;
  const calendar = useCloseoutCalendar(open ? branch?.id ?? 0 : 0);
  const create = useCreateIncomeStatement();
  const [retryError, setRetryError] = useState<string | null>(null);
  const initialValues = useMemo(() => ({
    date: calendar.data?.today ?? "",
    branchId: branch?.id ?? 0,
    branchCode: "",
    branchName: branch?.name ?? "",
    currency: "USD",
    rate: 1,
  }), [calendar.data?.today, branch?.id, branch?.name]);
  const canCreate = hasPermission("canCreateIncomeStatement", "income_statement");
  const error = retryError ?? (create.isError ? normalizeApiError(create.error).message
    : !canCreate ? t("accounting.dailyIncome.statement.createPermission") : null);

  async function submit(values: DailyIncomeStatementValues) {
    setRetryError(null);
    let statement: DailyIncomeStatement;
    try {
      statement = await create.mutateAsync(values);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("accounting.dailyIncome.statement.createTitle")}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.statement.rolloverHelp")}</DialogDescription>
        </DialogHeader>
        {branch && calendar.data ? (
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
          <p role="status">{user.isError ? normalizeApiError(user.error).message
            : calendar.isError ? normalizeApiError(calendar.error).message : t("common.loading")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
