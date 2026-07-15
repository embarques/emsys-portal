"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import { buildTransactionAssigneeOptions } from "@/lib/accounting/daily-income/assignee";
import {
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
  useCreateIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import { createDailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import {
  isCheckPaymentMethod,
  isZellePaymentMethod,
  requiresBankAccount,
  type DailyIncomeJournal,
  type DailyIncomeStatement,
  type DailyIncomeStatementValues,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  createInvoiceDailyIncomeRegistrationSchema,
  type InvoiceDailyIncomeRegistrationValues,
} from "@/lib/invoices/schemas/invoice-daily-income.schema";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  open: boolean;
  statement: DailyIncomeStatement | null;
  date: string;
  invoice: InvoiceFormValues;
  onOpenChange: (open: boolean) => void;
  onStatementCreated: (statement: DailyIncomeStatement) => void | Promise<void>;
  onRegistered: (journal: DailyIncomeJournal) => void | Promise<void>;
};

const DEFAULT_VALUES: InvoiceDailyIncomeRegistrationValues = {
  amount: 0,
  refNumber: "",
  description: "",
};

export function InvoiceDailyIncomeDialog({
  open,
  statement,
  date,
  invoice,
  onOpenChange,
  onStatementCreated,
  onRegistered,
}: Props) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [activeStatement, setActiveStatement] = useState(statement);
  const currentUserQuery = useCurrentUser();
  const branchesQuery = useBranchPicker(200, { enabled: open });
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const paymentMethodsQuery = useAccountingPaymentMethods(open);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, open);
  const createJournal = useCreateDailyIncomeJournal();
  const createStatement = useCreateIncomeStatement();
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const invoiceSubtotal = useMemo(
    () => invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [invoice.lineItems],
  );
  const invoiceTotal = Math.max(0, invoiceSubtotal - (Number(invoice.discount) || 0));
  const registrationSchema = useMemo(
    () => createInvoiceDailyIncomeRegistrationSchema(invoiceTotal),
    [invoiceTotal],
  );
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

  const {
    formState: { errors },
    handleSubmit,
    getValues,
    register,
    reset,
    setValue,
    watch,
  } = useForm<InvoiceDailyIncomeRegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const statementForm = useForm<DailyIncomeStatementValues>({
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

  useEffect(() => {
    if (!open) return;
    reset({
      ...DEFAULT_VALUES,
      description: t("invoices.wizard.dailyIncome.dialog.initialRegistrationDescription"),
    });
    setSubmitError(null);
    setStatementError(null);
    setCardFlipped(false);
    setActiveStatement(statement);
  }, [open, reset, statement, t]);

  useEffect(() => {
    const userBranch = currentUserQuery.data?.branch;
    if (!open || !userBranch || branches.length === 0) return;
    const branch = branches.find((item) => item.id === userBranch.id) ?? branches[0];
    statementForm.reset({
      date,
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      currency: "USD",
      rate: 1,
    });
  }, [branches, currentUserQuery.data?.branch, date, open, statementForm]);

  const amount = watch("amount") ?? 0;
  const paymentAmount = Number(amount) || 0;
  const balance = invoiceTotal - paymentAmount;
  const balanceIsNegative = balance < 0;
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const paymentAccountId = watch("paymentAccountId");
  const employeeId = watch("employeeId");
  const paymentRequired = amount > 0;
  const needsBankAccount = paymentRequired && requiresBankAccount(paymentMethodName);
  const isZelle = paymentRequired && isZellePaymentMethod(paymentMethodName);
  const isCheck = paymentRequired && isCheckPaymentMethod(paymentMethodName);
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const employeeOptions = useMemo(() => buildTransactionAssigneeOptions(employees), [employees]);
  const statementOpen = activeStatement?.status === "OPEN";
  const statementCurrency = statementForm.watch("currency");
  const statementBranchId = statementForm.watch("branchId");
  const selectedStatementBranch = branches.find((branch) => branch.id === statementBranchId);
  const showExchangeRate = selectedStatementBranch?.code.trim().toUpperCase() === "RD";
  const statementErrors = statementForm.formState.errors;
  const branchOptions = branches.map((branch) => ({
    value: String(branch.id),
    label: `${branch.code} — ${branch.name}`,
    keywords: [branch.code, branch.name],
  }));

  useEffect(() => {
    if (!showExchangeRate) {
      statementForm.setValue("rate", 1, { shouldValidate: true });
    }
  }, [showExchangeRate, statementForm]);

  useEffect(() => {
    const user = currentUserQuery.data;
    if (!open || !user || employees.length === 0 || getValues("employeeId")) return;
    const normalizedEmail = user.email.trim().toLowerCase();
    const employee =
      employees.find((item) => item.user?.id === user.id) ??
      employees.find((item) => item.email.trim().toLowerCase() === normalizedEmail) ??
      employees.find((item) => item.name.trim().toLowerCase() === user.name.trim().toLowerCase());
    if (!employee) return;
    setValue("employeeId", employee.id, { shouldValidate: true });
    setValue("employeeName", employee.name, { shouldValidate: true });
  }, [currentUserQuery.data, employees, getValues, open, setValue]);

  async function createDailyIncome(values: DailyIncomeStatementValues) {
    try {
      setStatementError(null);
      const created = await createStatement.mutateAsync(values);
      setActiveStatement(created);
      setCardFlipped(false);
      await onStatementCreated(created);
    } catch (error) {
      setStatementError(normalizeApiError(error).message);
    }
  }

  async function submit(values: InvoiceDailyIncomeRegistrationValues) {
    const currentUser = currentUserQuery.data;
    if (!activeStatement || activeStatement.status !== "OPEN") {
      setSubmitError(t("invoices.wizard.dailyIncome.dialog.statementMustBeOpen"));
      return;
    }
    if (!currentUser) {
      setSubmitError(t("invoices.wizard.dailyIncome.dialog.employeeUnavailable"));
      return;
    }

    try {
      setSubmitError(null);
      const journal = await createJournal.mutateAsync({
        statement: activeStatement,
        values: {
          transactionType: "INITIAL-PAYMENT",
          amount: values.amount,
          refNumber: values.refNumber,
          description: values.description,
          employeeId: values.employeeId,
          employeeName: values.employeeName,
          invoiceNumber: invoice.invoiceNumber,
          invoiceCost: invoiceSubtotal,
          invoiceDiscount: Number(invoice.discount) || 0,
          includeSender: Boolean(invoice.sender),
          senderId: invoice.sender?.id,
          senderName: invoice.sender?.name,
          includeReceiver: Boolean(invoice.receiver),
          receiverId: invoice.receiver?.id,
          receiverName: invoice.receiver?.name,
          paymentMethodId: paymentRequired ? values.paymentMethodId : undefined,
          paymentMethodName: paymentRequired ? values.paymentMethodName : undefined,
          paymentAccountId: needsBankAccount ? values.paymentAccountId : undefined,
          paymentAccountName: needsBankAccount ? values.paymentAccountName : undefined,
          paymentAccountType: needsBankAccount ? values.paymentAccountType : undefined,
          zelleTransactionDate: isZelle ? values.zelleTransactionDate : undefined,
          zelleTransactionName: isZelle ? values.zelleTransactionName : undefined,
          checkNumber: isCheck ? values.checkNumber : undefined,
        },
      });

      if (!journal) throw new Error(t("invoices.wizard.dailyIncome.dialog.registrationMissing"));
      await onRegistered(journal);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(normalizeApiError(error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.wizard.dailyIncome.dialog.title")}</DialogTitle>
          <DialogDescription>{t("invoices.wizard.dailyIncome.dialog.description")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <div
            className="relative transition-[height] duration-300 [perspective:1200px]"
            style={{ height: cardFlipped ? 286 : 190 }}
          >
            <div
              className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: cardFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              <section
                aria-hidden={cardFlipped}
                inert={cardFlipped ? true : undefined}
                className="absolute inset-0 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm [backface-visibility:hidden] dark:border-blue-900 dark:bg-blue-950/30"
                style={{ pointerEvents: cardFlipped ? "none" : "auto" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <p className="font-semibold">{t("invoices.wizard.dailyIncome.dialog.todaysDailyIncome")}</p>
                    {activeStatement ? (
                      <>
                        <div className="flex items-center gap-2">
                          {statementOpen ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="size-4 text-amber-600" />
                          )}
                          <span className="font-medium">
                            {t("invoices.wizard.dailyIncome.dialog.incomeStatement", {
                              id: activeStatement.id,
                            })}
                          </span>
                          <span className={statementOpen ? "text-emerald-700" : "text-amber-700"}>
                            · {statementOpen ? t("invoices.wizard.dailyIncome.dialog.open") : t("invoices.wizard.dailyIncome.dialog.closed")}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {activeStatement.date} · {activeStatement.branch?.name || activeStatement.branch?.code || t("invoices.wizard.dailyIncome.dialog.currentBranch")}
                        </p>
                        <div className="flex gap-8 text-xs text-muted-foreground">
                          <span>
                            {t("invoices.wizard.dailyIncome.dialog.currency")}{" "}
                            <strong className="text-foreground">{activeStatement.currency}</strong>
                          </span>
                          {activeStatement.branch?.code?.trim().toUpperCase() === "RD" ? (
                            <span>
                              {t("invoices.wizard.dailyIncome.dialog.rate")}{" "}
                              <strong className="text-foreground">{activeStatement.rate.toFixed(2)}</strong>
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertCircle className="size-4" />
                          <span className="font-medium">{t("invoices.wizard.dailyIncome.dialog.noStatementToday")}</span>
                        </div>
                        <p className="text-muted-foreground">
                          {t("invoices.wizard.dailyIncome.dialog.createStatementHint")}
                        </p>
                      </>
                    )}
                  </div>
                  <div className={activeStatement ? "w-[46%] space-y-1.5" : "text-right"}>
                    {activeStatement ? (
                      <>
                        <Label htmlFor="invoice-payment-employee">
                          {t("invoices.wizard.dailyIncome.dialog.employee")} <span className="text-destructive">*</span>
                        </Label>
                        <SearchableSelect
                          id="invoice-payment-employee"
                          value={employeeId ? String(employeeId) : ""}
                          onValueChange={(next) => {
                            const employee = employees.find((item) => item.id === Number(next));
                            setValue("employeeId", employee?.id, { shouldValidate: true });
                            setValue("employeeName", employee?.name ?? "", { shouldValidate: true });
                          }}
                          options={employeeOptions}
                          loading={employeesQuery.isLoading}
                          placeholder={t("invoices.wizard.dailyIncome.dialog.selectEmployee")}
                          searchPlaceholder={t("invoices.wizard.dailyIncome.dialog.searchEmployees")}
                        />
                        {errors.employeeId ? (
                          <p className="text-xs text-destructive">{errors.employeeId.message}</p>
                        ) : null}
                      </>
                    ) : (
                      <Button
                        data-testid="invoice-daily-income-flip-create"
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCardFlipped(true)}
                      >
                        <RotateCcw className="size-4" />
                        {t("invoices.wizard.dailyIncome.dialog.createDailyIncome")}
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              <section
                aria-hidden={!cardFlipped}
                inert={!cardFlipped ? true : undefined}
                className="absolute inset-0 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-blue-900 dark:bg-blue-950/30"
                style={{ pointerEvents: cardFlipped ? "auto" : "none" }}
              >
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">{t("invoices.wizard.dailyIncome.dialog.createDailyIncomeTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("invoices.wizard.dailyIncome.dialog.createDailyIncomeHint")}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-date">{t("invoices.form.fields.date")}</Label>
                      <DateInput
                        id="invoice-statement-date"
                        {...statementForm.register("date")}
                      />
                      {statementErrors.date ? (
                        <p className="text-xs text-destructive">{statementErrors.date.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-branch">{t("invoices.wizard.dailyIncome.dialog.branch")}</Label>
                      <SearchableSelect
                        id="invoice-statement-branch"
                        value={statementBranchId ? String(statementBranchId) : ""}
                        onValueChange={(next) => {
                          const branch = branches.find((item) => item.id === Number(next));
                          statementForm.setValue("branchId", branch?.id ?? 0, { shouldValidate: true });
                          statementForm.setValue("branchCode", branch?.code ?? "", { shouldValidate: true });
                          statementForm.setValue("branchName", branch?.name ?? "", { shouldValidate: true });
                        }}
                        options={branchOptions}
                        loading={branchesQuery.isLoading}
                        placeholder={t("invoices.wizard.dailyIncome.dialog.selectBranch")}
                        searchPlaceholder={t("invoices.wizard.dailyIncome.dialog.searchBranches")}
                      />
                      {statementErrors.branchId ? (
                        <p className="text-xs text-destructive">{statementErrors.branchId.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-currency">{t("invoices.wizard.dailyIncome.dialog.currency")}</Label>
                      <SearchableSelect
                        id="invoice-statement-currency"
                        value={statementCurrency}
                        onValueChange={(next) => statementForm.setValue("currency", next, { shouldValidate: true })}
                        options={[
                          { value: "USD", label: t("invoices.wizard.dailyIncome.dialog.currencyUsd") },
                          { value: "DOP", label: t("invoices.wizard.dailyIncome.dialog.currencyDop") },
                        ]}
                        placeholder={t("invoices.wizard.dailyIncome.dialog.selectCurrency")}
                      />
                    </div>
                    {showExchangeRate ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-statement-rate">{t("invoices.wizard.dailyIncome.dialog.exchangeRate")}</Label>
                        <Input
                          id="invoice-statement-rate"
                          type="number"
                          min={0}
                          step="0.01"
                          {...statementForm.register("rate", { valueAsNumber: true })}
                        />
                        {statementErrors.rate ? (
                          <p className="text-xs text-destructive">{statementErrors.rate.message}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {statementError ? <p className="text-xs text-destructive">{statementError}</p> : null}
                  <div className="flex justify-between gap-2 border-t border-blue-200 pt-3 dark:border-blue-900">
                    <Button type="button" size="sm" variant="outline" onClick={() => setCardFlipped(false)}>
                      <RotateCcw className="size-4" />
                      {t("invoices.wizard.dailyIncome.dialog.backToStatus")}
                    </Button>
                    <Button
                      data-testid="invoice-daily-income-create"
                      type="button"
                      size="sm"
                      disabled={
                        createStatement.isPending ||
                        !currentUserQuery.data ||
                        branchesQuery.isLoading ||
                        !statementBranchId
                      }
                      onClick={statementForm.handleSubmit(createDailyIncome)}
                    >
                      {createStatement.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      {createStatement.isPending
                        ? t("invoices.wizard.dailyIncome.dialog.creating")
                        : t("invoices.wizard.dailyIncome.dialog.createDailyIncome")}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {activeStatement ? (
            <>
              {!statementOpen ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  {t("invoices.wizard.dailyIncome.dialog.closedPaymentDisabled")}
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="daily-income-invoice-total">{t("invoices.wizard.dailyIncome.dialog.invoiceTotal")}</Label>
              <Input id="daily-income-invoice-total" value={formatInvoiceMoney(invoiceTotal)} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-income-payment-amount">{t("invoices.wizard.dailyIncome.dialog.paymentAmount")}</Label>
              <Input
                id="daily-income-payment-amount"
                type="number"
                min={0}
                max={invoiceTotal}
                step="0.01"
                inputMode="decimal"
                disabled={!statementOpen}
                {...register("amount", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                {t("invoices.wizard.dailyIncome.dialog.paymentOptionalHint")}
              </p>
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-income-balance">{t("invoices.wizard.dailyIncome.dialog.balance")}</Label>
              <Input
                id="daily-income-balance"
                value={formatInvoiceMoney(balance)}
                disabled
                className={balanceIsNegative ? "border-destructive text-destructive" : undefined}
              />
              {balanceIsNegative ? (
                <p className="text-xs text-destructive">
                  {t("invoices.wizard.dailyIncome.dialog.negativeBalance")}
                </p>
              ) : null}
            </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-semibold">{t("invoices.wizard.dailyIncome.dialog.paymentDetails")}</p>
              <p className="text-xs text-muted-foreground">
                {t("invoices.wizard.dailyIncome.dialog.paymentDetailsHint")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="daily-income-payment-method">{t("invoices.wizard.dailyIncome.paymentMethod")}</Label>
                <SearchableSelect
                  id="daily-income-payment-method"
                  disabled={!statementOpen || !paymentRequired}
                  value={paymentMethodId ? String(paymentMethodId) : ""}
                  onValueChange={(next) => {
                    const method = paymentMethods.find((item) => item.id === Number(next));
                    setValue("paymentMethodId", method?.id, { shouldValidate: true });
                    setValue("paymentMethodName", method?.name ?? "", { shouldValidate: true });
                    if (!requiresBankAccount(method?.name)) {
                      setValue("paymentAccountId", undefined, { shouldValidate: true });
                    }
                    if (!isZellePaymentMethod(method?.name)) {
                      setValue("zelleTransactionDate", undefined, { shouldValidate: true });
                      setValue("zelleTransactionName", undefined, { shouldValidate: true });
                    }
                    if (!isCheckPaymentMethod(method?.name)) {
                      setValue("checkNumber", undefined, { shouldValidate: true });
                    }
                  }}
                  placeholder={t("invoices.wizard.dailyIncome.dialog.selectPaymentMethod")}
                  searchPlaceholder={t("invoices.wizard.dailyIncome.dialog.searchPaymentMethods")}
                  options={paymentMethods.map((method) => ({
                    value: String(method.id),
                    label: method.name,
                  }))}
                />
                {errors.paymentMethodId ? (
                  <p className="text-xs text-destructive">{errors.paymentMethodId.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-income-payment-account">{t("invoices.wizard.dailyIncome.dialog.paymentAccount")}</Label>
                <SearchableSelect
                  id="daily-income-payment-account"
                  disabled={!statementOpen || !needsBankAccount}
                  value={paymentAccountId ? String(paymentAccountId) : ""}
                  onValueChange={(next) => {
                    const account = bankAccounts.find((item) => item.id === Number(next));
                    setValue("paymentAccountId", account?.id, { shouldValidate: true });
                    setValue("paymentAccountName", account?.displayName ?? "");
                    setValue("paymentAccountType", account?.type);
                  }}
                  placeholder={t("invoices.wizard.dailyIncome.dialog.selectBankAccount")}
                  searchPlaceholder={t("invoices.wizard.dailyIncome.dialog.searchBankAccounts")}
                  options={bankAccounts.map((account) => ({
                    value: String(account.id),
                    label: account.displayName,
                  }))}
                />
                {errors.paymentAccountId ? (
                  <p className="text-xs text-destructive">{errors.paymentAccountId.message}</p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="daily-income-reference">{t("invoices.wizard.dailyIncome.dialog.referenceNumber")}</Label>
                <Input
                  id="daily-income-reference"
                  disabled={!statementOpen || !paymentRequired}
                  {...register("refNumber")}
                />
                {errors.refNumber ? <p className="text-xs text-destructive">{errors.refNumber.message}</p> : null}
              </div>

              {isZelle ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="daily-income-zelle-date">{t("invoices.wizard.dailyIncome.dialog.zelleTransactionDate")}</Label>
                    <Input id="daily-income-zelle-date" type="date" {...register("zelleTransactionDate")} />
                    {errors.zelleTransactionDate ? (
                      <p className="text-xs text-destructive">{errors.zelleTransactionDate.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily-income-zelle-name">{t("invoices.wizard.dailyIncome.dialog.zelleTransactionName")}</Label>
                    <Input id="daily-income-zelle-name" {...register("zelleTransactionName")} />
                    {errors.zelleTransactionName ? (
                      <p className="text-xs text-destructive">{errors.zelleTransactionName.message}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {isCheck ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="daily-income-check-number">
                    {t("invoices.wizard.dailyIncome.dialog.checkNumber")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="daily-income-check-number"
                    disabled={!statementOpen || !paymentRequired}
                    placeholder={t("invoices.wizard.dailyIncome.dialog.checkNumberPlaceholder")}
                    autoComplete="off"
                    {...register("checkNumber")}
                  />
                  {errors.checkNumber ? (
                    <p className="text-xs text-destructive">{errors.checkNumber.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
              </div>

              <div>
            <div className="space-y-2">
              <Label htmlFor="daily-income-description">{t("invoices.wizard.dailyIncome.dialog.descriptionField")}</Label>
              <Input id="daily-income-description" disabled={!statementOpen} {...register("description")} />
              {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
            </div>
              </div>
            </>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            {activeStatement ? (
              <Button
                type="submit"
                disabled={
                  !statementOpen ||
                  createJournal.isPending ||
                  currentUserQuery.isLoading ||
                  balanceIsNegative
                }
              >
                {createJournal.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {createJournal.isPending
                  ? t("invoices.wizard.dailyIncome.dialog.registering")
                  : t("invoices.wizard.dailyIncome.dialog.registerAndContinue")}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
