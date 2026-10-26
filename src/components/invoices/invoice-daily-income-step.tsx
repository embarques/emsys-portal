"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";

import { InvoicePaymentTransactionForm } from "@/components/invoices/invoice-payment-transaction-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import {
  useDailyIncomeInvoiceRegistration,
  useCurrentIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import type {
  DailyIncomeJournal,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { type InvoiceDailyIncomeContext } from "@/lib/invoices/invoice-daily-income-context";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  isInvoiceEmployeePickupSource,
  mapPaymentLocationToPaidRegion,
  type InvoiceFormValues,
  type InvoicePaymentLocation,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { formatActiveRouteAssignmentLabel } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

type Props = {
  values: InvoiceFormValues;
  onContextChange: (context: InvoiceDailyIncomeContext) => void;
  /** Payment posted or skipped ($0): continue to the next wizard step with this context. */
  onContinue?: (context: InvoiceDailyIncomeContext) => void;
  /** Set while the inline payment form is shown; the wizard Next button calls it. */
  paymentSubmitRef: MutableRefObject<(() => Promise<void>) | null>;
  onPaymentLocationChange?: (paymentLocation: InvoicePaymentLocation) => void;
};

function PendingPaymentBranchField({
  value,
  onChange,
  className,
}: {
  value: InvoicePaymentLocation;
  onChange?: (paymentLocation: InvoicePaymentLocation) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="space-y-2">
        <Label htmlFor="paymentLocation">
          {t("invoices.form.fields.paymentLocation")}
          <span className="text-destructive"> *</span>
        </Label>
        <SearchableSelect
          id="paymentLocation"
          value={mapPaymentLocationToPaidRegion(value)}
          onValueChange={(next) => onChange?.(next as InvoicePaymentLocation)}
          placeholder={t("invoices.form.fields.paymentLocation")}
          required
          loading={branchesQuery.isLoading}
          options={branches
            .filter((branch) => branch.code.trim())
            .map((branch) => ({
              value: branch.code.trim().toUpperCase(),
              label: branch.code.trim().toUpperCase(),
            }))}
        />
      </div>
    </div>
  );
}

export function InvoiceDailyIncomeStep({
  values,
  onContextChange,
  onContinue,
  paymentSubmitRef,
  onPaymentLocationChange,
}: Props) {
  const { t } = useTranslation();
  const isMobileLayout = useIsMobileViewport();
  const paymentLocationField = (
    <PendingPaymentBranchField
      value={values.paymentLocation}
      onChange={onPaymentLocationChange}
    />
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [localRegistration, setLocalRegistration] = useState<DailyIncomeJournal | null>(null);
  const currentUserQuery = useCurrentUser();
  const branchId = currentUserQuery.data?.branch.id ?? 0;
  const registrationQuery = useDailyIncomeInvoiceRegistration(values.invoiceNumber);
  const registration = registrationQuery.data ?? localRegistration;
  const statementQuery = useCurrentIncomeStatement(branchId);
  const statement = statementQuery.data ?? null;
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled: values.pickupSource === "route" && Boolean(values.routeId),
  });

  useEffect(() => {
    setLocalRegistration((current) => current?.invoice?.number === values.invoiceNumber ? current : null);
  }, [values.invoiceNumber]);

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
    // New invoices often have no number yet (auto-generate), so the registration
    // query stays disabled and never reaches isSuccess. Still sync skip + open
    // Cuadre id so Next validation matches what the step UI already shows.
    const hasInvoiceNumber = Boolean(values.invoiceNumber.trim());
    if (hasInvoiceNumber && !registrationQuery.isSuccess && !localRegistration) return;

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
      paymentSkipped: true,
    });
  }, [
    associatedStatementId,
    localRegistration,
    onContextChange,
    registration,
    registrationQuery.isSuccess,
    values.invoiceNumber,
  ]);

  const applyRegistration = useCallback(
    async (journal: DailyIncomeJournal) => {
      setLocalRegistration(journal);
      onContextChange({
        registration: journal,
        incomeStatementId: journal.incomeStatementId || associatedStatementId,
        paymentSkipped: journal.amount === 0,
      });
      if (values.invoiceNumber.trim()) {
        await registrationQuery.refetch();
      }
    },
    [associatedStatementId, onContextChange, registrationQuery, values.invoiceNumber],
  );

  const isLoading =
    currentUserQuery.isLoading ||
    registrationQuery.isLoading ||
    (!registration && statementQuery.isLoading);
  const queryError =
    currentUserQuery.error ??
    registrationQuery.error ??
    (!registration ? statementQuery.error : null);

  async function handlePaymentPosted(journal: DailyIncomeJournal) {
    await applyRegistration(journal);
    onContinue?.({
      registration: journal,
      incomeStatementId: journal.incomeStatementId || associatedStatementId,
      paymentSkipped: journal.amount === 0,
    });
  }

  function skipPaymentAndContinue() {
    const context: InvoiceDailyIncomeContext = {
      registration: null,
      incomeStatementId: associatedStatementId,
      paymentSkipped: true,
    };
    onContextChange(context);
    onContinue?.(context);
  }

  const paymentForm = statement && statementOpen ? (
    <div className="space-y-3" data-invoice-wizard-focus="daily-income">
      <p className={cn("leading-relaxed text-muted-foreground", isMobileLayout ? "text-base" : "text-sm")}>
        {t("invoices.wizard.dailyIncome.unpaidContinueHint", { id: statement.id })}
      </p>
      <InvoicePaymentTransactionForm
        statement={statement}
        invoice={values}
        onRegistered={handlePaymentPosted}
        onSkip={skipPaymentAndContinue}
        submitRef={paymentSubmitRef}
      />
    </div>
  ) : null;

  async function refreshStatus() {
    setStatusError(null);
    await Promise.all([registrationQuery.refetch(), statementQuery.refetch()]);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        {paymentLocationField}
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("invoices.wizard.dailyIncome.checking")}
        </div>
      </div>
    );
  }

  if (isMobileLayout) {
    if (queryError) {
      return (
        <div className="space-y-5">
          {paymentLocationField}
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">{t("invoices.wizard.dailyIncome.unableToCheck")}</p>
                <p className="text-sm text-muted-foreground">{normalizeApiError(queryError).message}</p>
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={refreshStatus} aria-label={t("invoices.wizard.dailyIncome.refresh")}>
            <RefreshCw className="size-4" />
            {t("invoices.wizard.dailyIncome.refresh")}
          </Button>
        </div>
      );
    }

    if (registration) {
      return (
        <div className="space-y-5">
          {paymentLocationField}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {t("invoices.wizard.dailyIncome.entryFound")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("invoices.wizard.dailyIncome.incomeStatement", {
                    id: registration.incomeStatementId,
                  })}
                  {" · "}
                  {registration.date || t("invoices.wizard.dailyIncome.previouslyRegistered")}
                  {" · "}
                  {t("invoices.wizard.dailyIncome.paymentRecorded", {
                    amount: formatInvoiceMoney(registration.amount),
                  })}
                  {registration.paymentMethod?.name ? ` · ${registration.paymentMethod.name}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => registrationQuery.refetch()}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!statement) {
      return (
        <div className="space-y-5">
          {paymentLocationField}
          <p role="status">{t("accounting.financialActivity.noCurrentCloseout")}</p>
          <Button type="button" variant="outline" onClick={refreshStatus}>{t("accounting.financialActivity.refresh")}</Button>
        </div>
      );
    }

    if (!statementOpen) {
      return (
        <div className="space-y-5">
          {paymentLocationField}
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="space-y-2">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                {t("invoices.wizard.dailyIncome.noOpenTitle")}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("invoices.wizard.dailyIncome.closedStatementOptional")}
              </p>
              {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={refreshStatus} aria-label={t("invoices.wizard.dailyIncome.refresh")}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {paymentLocationField}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                {t("invoices.wizard.dailyIncome.openAssociated")}
              </p>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {t("invoices.wizard.dailyIncome.openAssociatedHint", { id: statement.id })}
              </p>
              <p className="mt-3 text-sm leading-snug text-muted-foreground">
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
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
              <RefreshCw className="size-4" />
              {t("invoices.wizard.dailyIncome.refresh")}
            </Button>
          </div>
        </div>

        {paymentForm}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {paymentLocationField}

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
                  {registration.invoice?.cost != null && Number.isFinite(registration.invoice.cost) ? (
                    <span>
                      {t("invoices.wizard.dailyIncome.invoiceCostRegistered", {
                        amount: formatInvoiceMoney(registration.invoice.cost),
                      })}
                    </span>
                  ) : null}
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

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid flex-1 gap-5 sm:grid-cols-3">
                {registration.invoice?.cost != null && Number.isFinite(registration.invoice.cost) ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("invoices.wizard.summary.registeredCost")}
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatInvoiceMoney(registration.invoice.cost)}
                    </p>
                  </div>
                ) : null}
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
          {statementOpen && statement ? (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold">
                      {t("invoices.wizard.dailyIncome.openAssociated")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("invoices.wizard.dailyIncome.openAssociatedHint", { id: statement.id })}
                    </p>
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
                    {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
                    <RefreshCw className="size-4" />
                    {t("invoices.wizard.dailyIncome.refresh")}
                  </Button>
                </div>
              </div>

              {paymentForm}
            </>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {t(statement?.status === "CLOSED"
                      ? "invoices.wizard.dailyIncome.closedTitle"
                      : "invoices.wizard.dailyIncome.setupTitle")}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {t(statement?.status === "CLOSED"
                      ? "invoices.wizard.dailyIncome.closedSetupHint"
                      : "invoices.wizard.dailyIncome.setupHint")}
                  </p>
                  {statusError ? <p role="alert" className="mt-3 text-sm text-destructive">{statusError}</p> : null}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={refreshStatus}
                      disabled={statementQuery.isFetching || registrationQuery.isFetching}
                    >
                      <RefreshCw className={cn("size-4", (statementQuery.isFetching || registrationQuery.isFetching) && "animate-spin")} aria-hidden="true" />
                      {t("invoices.wizard.dailyIncome.refresh")}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("invoices.wizard.dailyIncome.zeroPaymentHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}


    </div>
  );
}
