"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Lock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { InvoiceDailyIncomeDialog } from "@/components/invoices/invoice-daily-income-dialog";
import { InvoicePaymentTransactionForm } from "@/components/invoices/invoice-payment-transaction-form";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import {
  useCreateIncomeStatement,
  useDailyIncomeInvoiceRegistration,
  useIncomeStatement,
  useSetIncomeStatementStatus,
} from "@/lib/accounting/daily-income/hooks";
import { parseSingleOpenIncomeStatement } from "@/lib/accounting/daily-income/open-statement-error";
import { createDailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import type {
  DailyIncomeJournal,
  DailyIncomeStatement,
  DailyIncomeStatementValues,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
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

function MobileCreateDailyIncomePage({
  date,
  onCreated,
}: {
  date: string;
  onCreated: (statement: DailyIncomeStatement) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [statementError, setStatementError] = useState<string | null>(null);
  const [singleOpenStatement, setSingleOpenStatement] = useState<{ id: number; date: string } | null>(null);
  const currentUserQuery = useCurrentUser();
  const branchesQuery = useBranchPicker(200);
  const createStatement = useCreateIncomeStatement();
  const closeStatement = useSetIncomeStatementStatus();
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const statementSchema = useMemo(
    () =>
      createDailyIncomeStatementSchema({
        dateRequired: t("accounting.dailyIncome.form.validation.dateRequired"),
        branchRequired: t("accounting.dailyIncome.form.validation.branchRequired"),
        currencyRequired: t("accounting.dailyIncome.form.validation.currencyRequired"),
        rateNonNegative: t("accounting.dailyIncome.form.validation.rateNonNegative"),
      }),
    [t],
  );
  const form = useForm<DailyIncomeStatementValues>({
    resolver: zodResolver(statementSchema),
    defaultValues: {
      date,
      branchId: 0,
      branchCode: "",
      branchName: "",
      currency: "USD",
      rate: 1,
    },
  });
  const statementCurrency = form.watch("currency");
  const statementBranchId = form.watch("branchId");
  const selectedStatementBranch = branches.find((branch) => branch.id === statementBranchId);
  const showExchangeRate = selectedStatementBranch?.code.trim().toUpperCase() === "RD";
  const errors = form.formState.errors;
  const branchOptions = branches.map((branch) => ({
    value: String(branch.id),
    label: `${branch.code} — ${branch.name}`,
    keywords: [branch.code, branch.name],
  }));

  useEffect(() => {
    const userBranch = currentUserQuery.data?.branch;
    if (!userBranch || branches.length === 0 || statementBranchId) return;
    const branch = branches.find((item) => item.id === userBranch.id) ?? branches[0];
    form.reset({
      date,
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      currency: "USD",
      rate: 1,
    });
  }, [branches, currentUserQuery.data?.branch, date, form, statementBranchId]);

  useEffect(() => {
    if (!showExchangeRate) {
      form.setValue("rate", 1, { shouldValidate: true });
    }
  }, [form, showExchangeRate]);

  async function createDailyIncome(values: DailyIncomeStatementValues) {
    try {
      setStatementError(null);
      setSingleOpenStatement(null);
      const created = await createStatement.mutateAsync(values);
      await onCreated(created);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setStatementError(message);
      setSingleOpenStatement(parseSingleOpenIncomeStatement(message));
    }
  }

  async function closeSingleOpenStatement() {
    if (!singleOpenStatement) return;
    try {
      setStatementError(null);
      await closeStatement.mutateAsync({
        statement: {
          id: singleOpenStatement.id,
          date: singleOpenStatement.date,
          status: "OPEN",
          branch: selectedStatementBranch
            ? {
                id: selectedStatementBranch.id,
                code: selectedStatementBranch.code,
                name: selectedStatementBranch.name,
              }
            : undefined,
          currency: statementCurrency,
          rate: form.getValues("rate") || 1,
        },
        open: false,
      });
      setSingleOpenStatement(null);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setStatementError(message);
      setSingleOpenStatement(parseSingleOpenIncomeStatement(message));
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("invoices.wizard.dailyIncome.dialog.createDailyIncomeTitle")}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {t("invoices.wizard.dailyIncome.dialog.createDailyIncomeHint")}
        </p>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit(createDailyIncome)}>
        <div className="space-y-2" data-invoice-wizard-focus="daily-income">
          <Label htmlFor="invoice-mobile-statement-branch">
            {t("invoices.wizard.dailyIncome.dialog.branch")}
          </Label>
          <SearchableSelect
            id="invoice-mobile-statement-branch"
            value={statementBranchId ? String(statementBranchId) : ""}
            onValueChange={(next) => {
              const branch = branches.find((item) => item.id === Number(next));
              form.setValue("branchId", branch?.id ?? 0, { shouldValidate: true });
              form.setValue("branchCode", branch?.code ?? "", { shouldValidate: true });
              form.setValue("branchName", branch?.name ?? "", { shouldValidate: true });
            }}
            options={branchOptions}
            loading={branchesQuery.isLoading}
            placeholder={t("invoices.wizard.dailyIncome.dialog.selectBranch")}
            searchPlaceholder={t("invoices.wizard.dailyIncome.dialog.searchBranches")}
            mobileSheet
          />
          {errors.branchId ? <p className="text-sm text-destructive">{errors.branchId.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-mobile-statement-date">{t("invoices.form.fields.date")}</Label>
          <DateInput id="invoice-mobile-statement-date" {...form.register("date")} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-mobile-statement-currency">
            {t("invoices.wizard.dailyIncome.dialog.currency")}
          </Label>
          <SearchableSelect
            id="invoice-mobile-statement-currency"
            value={statementCurrency}
            onValueChange={(next) => form.setValue("currency", next, { shouldValidate: true })}
            options={[
              { value: "USD", label: t("invoices.wizard.dailyIncome.dialog.currencyUsd") },
              { value: "DOP", label: t("invoices.wizard.dailyIncome.dialog.currencyDop") },
            ]}
            placeholder={t("invoices.wizard.dailyIncome.dialog.selectCurrency")}
            mobileSheet
          />
        </div>

        {showExchangeRate ? (
          <div className="space-y-2">
            <Label htmlFor="invoice-mobile-statement-rate">
              {t("invoices.wizard.dailyIncome.dialog.exchangeRate")}
            </Label>
            <Input
              id="invoice-mobile-statement-rate"
              type="number"
              min={0}
              step="0.01"
              {...form.register("rate", { valueAsNumber: true })}
            />
            {errors.rate ? <p className="text-sm text-destructive">{errors.rate.message}</p> : null}
          </div>
        ) : null}

        {statementError ? (
          <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p>{statementError}</p>
            {singleOpenStatement ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-xl border-destructive/30 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={closeSingleOpenStatement}
                disabled={closeStatement.isPending}
              >
                {closeStatement.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                {t("invoices.wizard.dailyIncome.dialog.closeOpenStatement", {
                  id: singleOpenStatement.id,
                })}
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl text-base font-semibold"
          disabled={createStatement.isPending || currentUserQuery.isLoading || branchesQuery.isLoading}
        >
          {createStatement.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {createStatement.isPending
            ? t("invoices.wizard.dailyIncome.dialog.creating")
            : t("invoices.wizard.dailyIncome.dialog.createDailyIncome")}
        </Button>
      </form>
    </section>
  );
}

export function InvoiceDailyIncomeStep({ values, onContextChange }: Props) {
  const { t } = useTranslation();
  const isMobileLayout = useIsMobileViewport();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [localRegistration, setLocalRegistration] = useState<DailyIncomeJournal | null>(null);
  const [localStatement, setLocalStatement] = useState<DailyIncomeStatement | null>(null);
  const [skipPayment, setSkipPayment] = useState(true);
  const currentUserQuery = useCurrentUser();
  const branchId = currentUserQuery.data?.branch.id ?? 0;
  const currentDate = todayDateValue();
  const registrationQuery = useDailyIncomeInvoiceRegistration(values.invoiceNumber);
  const registration = registrationQuery.data ?? localRegistration;
  const statementQuery = useIncomeStatement(branchId, currentDate);
  const statement = localStatement ?? statementQuery.data ?? null;
  const reopenMutation = useSetIncomeStatementStatus();
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled: values.pickupSource === "route" && Boolean(values.routeId),
  });

  useEffect(() => {
    setLocalRegistration(null);
  }, [values.invoiceNumber]);

  useEffect(() => {
    setLocalStatement(null);
  }, [branchId, currentDate]);

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
    if (!registrationQuery.isSuccess && !localRegistration) return;

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
      paymentSkipped: skipPayment,
    });
  }, [
    associatedStatementId,
    localRegistration,
    onContextChange,
    registration,
    registrationQuery.isSuccess,
    skipPayment,
  ]);

  const applyRegistration = useCallback(
    async (journal: DailyIncomeJournal) => {
      setLocalRegistration(journal);
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

  function handleSkipPaymentChange(checked: boolean) {
    setSkipPayment(checked);
    onContextChange({
      registration: null,
      incomeStatementId: associatedStatementId,
      paymentSkipped: checked,
    });
  }

  async function handleStatementCreated(created?: DailyIncomeStatement) {
    setStatusError(null);
    if (created) {
      setLocalStatement(created);
    }
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

  if (isMobileLayout) {
    if (queryError) {
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">{t("invoices.wizard.dailyIncome.unableToCheck")}</p>
                <p className="text-sm text-muted-foreground">{normalizeApiError(queryError).message}</p>
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={refreshStatus}>
            <RefreshCw className="size-4" />
            {t("invoices.wizard.dailyIncome.refresh")}
          </Button>
        </div>
      );
    }

    if (registration) {
      return (
        <div className="space-y-5">
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

    const mobileSkipPaymentCard = (
      <div className="rounded-xl border bg-card p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-border accent-primary"
            checked={skipPayment}
            data-invoice-wizard-focus="daily-income"
            onChange={(event) => handleSkipPaymentChange(event.currentTarget.checked)}
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">
              {t("invoices.wizard.dailyIncome.skipPayment")}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {t("invoices.wizard.dailyIncome.skipPaymentHint")}
            </span>
          </span>
        </label>
      </div>
    );

    if (!statement) {
      return (
        <div className="space-y-5">
          <MobileCreateDailyIncomePage date={currentDate} onCreated={handleStatementCreated} />
        </div>
      );
    }

    if (!statementOpen) {
      return (
        <div className="space-y-5">
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
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl"
                onClick={reopenDailyIncome}
                disabled={reopenMutation.isPending}
                data-invoice-wizard-focus="daily-income"
              >
                {reopenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("invoices.wizard.dailyIncome.reopenCuadre")}
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={refreshStatus}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
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

        <p className="text-base leading-relaxed text-muted-foreground">
          {skipPayment
            ? t("invoices.wizard.dailyIncome.skipWithCuadreHint", { id: statement.id })
            : t("invoices.wizard.dailyIncome.recordBeforeContinueHint")}
        </p>

        {mobileSkipPaymentCard}

        {!skipPayment ? (
          <InvoicePaymentTransactionForm
            statement={statement}
            invoice={values}
            onRegistered={handleRegistered}
          />
        ) : null}
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
          {statementOpen && statement ? (
            <>
              <div className="rounded-lg border bg-card p-4">
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

              <p className="text-sm text-muted-foreground">
                {skipPayment
                  ? t("invoices.wizard.dailyIncome.skipWithCuadreHint", { id: statement.id })
                  : t("invoices.wizard.dailyIncome.recordBeforeContinueHint")}
              </p>
              <div className="rounded-lg border bg-card p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-border accent-primary"
                    checked={skipPayment}
                    data-invoice-wizard-focus="daily-income"
                    onChange={(event) => handleSkipPaymentChange(event.currentTarget.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {t("invoices.wizard.dailyIncome.skipPayment")}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t("invoices.wizard.dailyIncome.skipPaymentHint")}
                    </span>
                  </span>
                </label>
              </div>
              {!skipPayment ? (
                <InvoicePaymentTransactionForm
                  statement={statement}
                  invoice={values}
                  onRegistered={handleRegistered}
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    {t("invoices.wizard.dailyIncome.noOpenTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {statement?.status === "CLOSED"
                      ? t("invoices.wizard.dailyIncome.closedStatementOptional")
                      : t("invoices.wizard.dailyIncome.noStatementOptional")}
                  </p>
                  {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
                  <RefreshCw className="size-4" />
                  {t("invoices.wizard.dailyIncome.refresh")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {statement?.status === "CLOSED" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={reopenDailyIncome}
                    disabled={reopenMutation.isPending}
                    data-invoice-wizard-focus="daily-income"
                  >
                    {reopenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("invoices.wizard.dailyIncome.reopenCuadre")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                    data-invoice-wizard-focus="daily-income"
                  >
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
