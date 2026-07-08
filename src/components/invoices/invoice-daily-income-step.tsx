"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { InvoiceDailyIncomeDialog } from "@/components/invoices/invoice-daily-income-dialog";
import { Button } from "@/components/ui/button";
import {
  useDailyIncomeInvoiceRegistration,
  useIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { type InvoiceFormValues } from "@/lib/invoices/types";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  values: InvoiceFormValues;
  onRegistrationChange: (registration: DailyIncomeJournal | null) => void;
};

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InvoiceDailyIncomeStep({ values, onRegistrationChange }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentUserQuery = useCurrentUser();
  const branchId = currentUserQuery.data?.branch.id ?? 0;
  const currentDate = todayDateValue();
  const registrationQuery = useDailyIncomeInvoiceRegistration(values.invoiceNumber);
  const registration = registrationQuery.data ?? null;
  const statementQuery = useIncomeStatement(branchId, currentDate);
  const statement = statementQuery.data ?? null;

  useEffect(() => {
    if (!registrationQuery.isSuccess) return;
    onRegistrationChange(registration);
  }, [onRegistrationChange, registration, registrationQuery.isSuccess]);

  const isLoading =
    currentUserQuery.isLoading ||
    registrationQuery.isLoading ||
    (!registration && statementQuery.isLoading);
  const queryError =
    currentUserQuery.error ??
    registrationQuery.error ??
    (!registration ? statementQuery.error : null);
  async function handleRegistered(journal: DailyIncomeJournal) {
    onRegistrationChange(journal);
    await registrationQuery.refetch();
  }

  async function handleStatementCreated() {
    await statementQuery.refetch();
  }

  async function refreshMissingRegistration() {
    await Promise.all([registrationQuery.refetch(), statementQuery.refetch()]);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking Daily Income registration…
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
              <p className="font-semibold text-destructive">Unable to check Daily Income</p>
              <p className="text-sm text-muted-foreground">{normalizeApiError(queryError).message}</p>
            </div>
          </div>
        </div>
      ) : registration ? (
        <>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  Daily income entry found
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span>Daily income #{registration.incomeStatementId}</span>
                  <span>{registration.date || "Previously registered"}</span>
                  <span>Payment recorded: {formatInvoiceMoney(registration.amount)}</span>
                  {registration.paymentMethod?.name ? <span>{registration.paymentMethod.name}</span> : null}
                  {registration.refNumber ? <span>Reference: {registration.refNumber}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid flex-1 gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                  <p className="mt-1 text-xl font-semibold">{formatInvoiceMoney(registration.amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment method</p>
                  <p className="mt-1 text-sm font-medium">{registration.paymentMethod?.name || "No payment method (zero payment)"}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => registrationQuery.refetch()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-semibold text-destructive">Daily income entry required</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {statement?.status === "CLOSED"
                    ? "Today’s Daily Income is closed. Reopen it before registering a new payment for this invoice."
                    : statement
                      ? "This invoice cannot be created until it is registered in Daily Income."
                      : "No Daily Income exists for today and the current branch. Create it before registering this invoice."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
                  Open full Daily Income page
                </Button>
                <Button type="button" variant="ghost" onClick={refreshMissingRegistration}>
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
