"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InvoiceDailyIncomeDialog } from "@/components/invoices/invoice-daily-income-dialog";
import { InvoicePaymentTransactionForm } from "@/components/invoices/invoice-payment-transaction-form";
import { Button } from "@/components/ui/button";
import {
  useDailyIncomeInvoiceRegistration,
  useIncomeStatement,
  useSetIncomeStatementStatus,
} from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { type InvoiceDailyIncomeContext } from "@/lib/invoices/invoice-daily-income-context";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  isInvoiceEmployeePickupSource,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { formatActiveRouteAssignmentLabel } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  values: InvoiceFormValues;
  onContextChange: (context: InvoiceDailyIncomeContext) => void;
};

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InvoiceDailyIncomeStep({ values, onContextChange }: Props) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUser();
  const branchId = currentUserQuery.data?.branch.id ?? 0;
  const currentDate = todayDateValue();
  const registrationQuery = useDailyIncomeInvoiceRegistration(values.invoiceNumber);
  const registration = registrationQuery.data ?? null;
  const statementQuery = useIncomeStatement(branchId, currentDate);
  const statement = statementQuery.data ?? null;
  const reopenMutation = useSetIncomeStatementStatus();
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled: values.pickupSource === "route" && Boolean(values.routeId),
  });

  const statementOpen = statement?.status === "OPEN";
  const associatedStatementId = statementOpen && statement ? statement.id : null;

  const pickupAssignmentLabel = useMemo(() => {
    if (isInvoiceEmployeePickupSource(values.pickupSource)) {
      const employee = values.pickupEmployeeName.trim() || values.pickupEmployeeId;
      if (!employee) return null;
      const branch = values.officeBranchName.trim();
      return branch ? `${employee} · ${branch}` : employee;
    }

    if (!values.routeId) return null;
    const route = (pickupRoutesQuery.data?.items ?? []).find((entry) => entry.id === values.routeId);
    return route ? formatActiveRouteAssignmentLabel(route, t) : values.routeId;
  }, [
    pickupRoutesQuery.data?.items,
    t,
    values.officeBranchName,
    values.pickupEmployeeId,
    values.pickupEmployeeName,
    values.pickupSource,
    values.routeId,
  ]);

  useEffect(() => {
    if (!registrationQuery.isSuccess) return;

    if (registration) {
      onContextChange({
        registration,
        incomeStatementId: registration.incomeStatementId || associatedStatementId,
        paymentSkipped: registration.amount === 0,
      });
      return;
    }

    onContextChange({
      registration: null,
      incomeStatementId: associatedStatementId,
      paymentSkipped: false,
    });
  }, [
    associatedStatementId,
    onContextChange,
    registration,
    registrationQuery.isSuccess,
  ]);

  const applyRegistration = useCallback(
    async (journal: DailyIncomeJournal) => {
      onContextChange({
        registration: journal,
        incomeStatementId: journal.incomeStatementId || associatedStatementId,
        paymentSkipped: journal.amount === 0,
      });
      await registrationQuery.refetch();
    },
    [associatedStatementId, onContextChange, registrationQuery],
  );

  const isLoading =
    currentUserQuery.isLoading ||
    registrationQuery.isLoading ||
    (!registration && statementQuery.isLoading);
  const queryError =
    currentUserQuery.error ??
    registrationQuery.error ??
    (!registration ? statementQuery.error : null);

  async function handleRegistered(journal: DailyIncomeJournal) {
    await applyRegistration(journal);
  }

  async function handleStatementCreated() {
    setStatusError(null);
    await statementQuery.refetch();
  }

  async function refreshStatus() {
    setStatusError(null);
    await Promise.all([registrationQuery.refetch(), statementQuery.refetch()]);
  }

  async function reopenDailyIncome() {
    if (!statement) return;
    try {
      setStatusError(null);
      await reopenMutation.mutateAsync({ statement, open: true });
      await statementQuery.refetch();
    } catch (error) {
      setStatusError(normalizeApiError(error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("invoices.wizard.dailyIncome.checking")}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-5 sm:px-8">
      {queryError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">{t("invoices.wizard.dailyIncome.unableToCheck")}</p>
              <p className="text-sm text-muted-foreground">{normalizeApiError(queryError).message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!queryError && registration ? (
        <>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {t("invoices.wizard.dailyIncome.entryFound")}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {t("invoices.wizard.dailyIncome.incomeStatement", {
                      id: registration.incomeStatementId,
                    })}
                  </span>
                  <span>{registration.date || t("invoices.wizard.dailyIncome.previouslyRegistered")}</span>
                  <span>
                    {t("invoices.wizard.dailyIncome.paymentRecorded", {
                      amount: formatInvoiceMoney(registration.amount),
                    })}
                  </span>
                  {registration.paymentMethod?.name ? <span>{registration.paymentMethod.name}</span> : null}
                  {registration.refNumber ? (
                    <span>{t("invoices.wizard.dailyIncome.reference", { ref: registration.refNumber })}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid flex-1 gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("invoices.wizard.dailyIncome.amount")}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{formatInvoiceMoney(registration.amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("invoices.wizard.dailyIncome.paymentMethod")}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {registration.paymentMethod?.name || t("invoices.wizard.dailyIncome.noPaymentMethod")}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => registrationQuery.refetch()}>
                <RefreshCw className="size-4" />
                {t("invoices.wizard.dailyIncome.refresh")}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {!queryError && !registration ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold">
                  {statementOpen && statement
                    ? t("invoices.wizard.dailyIncome.openAssociated")
                    : t("invoices.wizard.dailyIncome.noOpenTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {statementOpen && statement
                    ? t("invoices.wizard.dailyIncome.openAssociatedHint", { id: statement.id })
                    : statement?.status === "CLOSED"
                      ? t("invoices.wizard.dailyIncome.closedStatementOptional")
                      : t("invoices.wizard.dailyIncome.noStatementOptional")}
                </p>
                {statementOpen && statement ? (
                  <div className="pt-1 text-xs text-muted-foreground">
                    {t("invoices.wizard.dailyIncome.incomeStatement", { id: statement.id })}
                    {" · "}
                    {statement.date}
                    {" · "}
                    {statement.branch?.name ||
                      statement.branch?.code ||
                      t("invoices.wizard.dailyIncome.dialog.currentBranch")}
                    {pickupAssignmentLabel ? (
                      <>
                        {" · "}
                        {pickupAssignmentLabel}
                      </>
                    ) : null}
                  </div>
                ) : null}
                {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
                <RefreshCw className="size-4" />
                {t("invoices.wizard.dailyIncome.refresh")}
              </Button>
            </div>

            {!statementOpen ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {statement?.status === "CLOSED" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={reopenDailyIncome}
                    disabled={reopenMutation.isPending}
                  >
                    {reopenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("invoices.wizard.dailyIncome.reopenCuadre")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                    {t("invoices.wizard.dailyIncome.createOrOpenCuadre")}
                  </Button>
                )}
              </div>
            ) : null}
          </div>

          {statementOpen && statement ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("invoices.wizard.dailyIncome.recordBeforeContinueHint")}
              </p>
              <InvoicePaymentTransactionForm
                statement={statement}
                invoice={values}
                onRegistered={handleRegistered}
              />
            </>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                {t("invoices.wizard.dailyIncome.openCuadreBeforePayment")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statement?.status === "CLOSED" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={reopenDailyIncome}
                    disabled={reopenMutation.isPending}
                  >
                    {reopenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("invoices.wizard.dailyIncome.reopenCuadre")}
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                    {t("invoices.wizard.dailyIncome.createOrOpenCuadre")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <InvoiceDailyIncomeDialog
        open={dialogOpen}
        statement={statement}
        date={currentDate}
        invoice={values}
        onOpenChange={setDialogOpen}
        onStatementCreated={handleStatementCreated}
        onRegistered={handleRegistered}
      />
    </div>
  );
}
