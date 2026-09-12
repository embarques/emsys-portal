"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { RegisterInventoryChangeFields } from "@/components/accounting/register-inventory-change-fields";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation, submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import { finalizeInventoryChangeJournal } from "@/lib/accounting/daily-income/inventory-change";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { getTransactionTypeOption, getTransactionFormSecondFieldId } from "@/lib/accounting/daily-income/transaction-type-config";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { createDailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import { findCashPaymentMethod, isCheckPaymentMethod, isZellePaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import { queryKeys } from "@/lib/query/query-keys";
import type { Employee } from "@/lib/employees/types";
import { getInvoiceBalanceAmount, getInvoicePrimaryReceiver, getInvoiceTotal, type Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type Props = {
  transactionType: JournalTransactionType;
  initialValues: DailyIncomeJournalValues;
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  accounts: ChartAccount[];
  bankAccounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  formId: string;
  showTypeSummary?: boolean;
  appearance?: "default" | "phone";
  focusSecondFieldSignal?: number;
  onSubmit: (values: DailyIncomeJournalValues) => void | Promise<void>;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

function isCashAccount(account: ChartAccount) {
  const searchable = [account.name, account.displayName].filter(Boolean).join(" ").toLowerCase();
  return /\bcash\b/.test(searchable) || /\befectivo\b/.test(searchable);
}

function isUserRevenueAccount(account: ChartAccount) {
  return account.type === "REVENUE" && !account.systemAccount;
}

export function DailyIncomeTransactionForm({
  transactionType,
  initialValues,
  employees,
  dailyRoutes,
  statementDate,
  accounts,
  bankAccounts,
  invoices,
  paymentMethods,
  formId,
  showTypeSummary = false,
  appearance = "default",
  focusSecondFieldSignal,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isPhone = appearance === "phone";
  const typeOption = getTransactionTypeOption(transactionType, t);
  const TypeIcon = typeOption.icon;
  const handleEnterNavigation = useFormEnterNavigation();
  const [sourceAccountDefaultCleared, setSourceAccountDefaultCleared] = useState(false);
  const schema = useMemo(
    () =>
      createDailyIncomeJournalSchema({
        amountRequired: t("accounting.dailyIncome.form.validation.amountRequired"),
        amountNonNegative: t("accounting.dailyIncome.form.validation.amountNonNegative"),
        amountPositive: t("accounting.dailyIncome.form.validation.amountPositive"),
        refNumberTooLong: t("accounting.dailyIncome.form.validation.refNumberTooLong"),
        descriptionTooLong: t("accounting.dailyIncome.form.validation.descriptionTooLong"),
        costPositive: t("accounting.dailyIncome.form.validation.costPositive"),
        discountNonNegative: t("accounting.dailyIncome.form.validation.discountNonNegative"),
        zelleDateRequired: t("accounting.dailyIncome.form.validation.zelleDateRequired"),
        zelleNameRequired: t("accounting.dailyIncome.form.validation.zelleNameRequired"),
        checkNumberRequired: t("accounting.dailyIncome.form.validation.checkNumberRequired"),
        bankAccountRequired: t("accounting.dailyIncome.form.validation.bankAccountRequired"),
        employeeRequired: t("accounting.dailyIncome.form.validation.employeeRequired"),
        invoiceRequired: t("accounting.dailyIncome.form.validation.invoiceRequired"),
        paymentMethodRequired: t("accounting.dailyIncome.form.validation.paymentMethodRequired"),
        amountExceedsCost: t("accounting.dailyIncome.form.validation.amountExceedsCost"),
        senderRequired: t("accounting.dailyIncome.form.validation.senderRequired"),
        receiverRequired: t("accounting.dailyIncome.form.validation.receiverRequired"),
        amountExceedsBalance: t("accounting.dailyIncome.form.validation.amountExceedsBalance"),
        accountRequired: t("accounting.dailyIncome.form.validation.accountRequired"),
        sourceAccountRequired: t("accounting.dailyIncome.form.validation.sourceAccountRequired"),
        inventoryRequired: t("accounting.dailyIncome.form.validation.inventoryRequired"),
        inventoryItemRequired: t("accounting.dailyIncome.form.validation.inventoryItemRequired"),
        inventoryQuantityRequired: t("accounting.dailyIncome.form.validation.inventoryQuantityRequired"),
        inventoryPriceRequired: t("accounting.dailyIncome.form.validation.inventoryPriceRequired"),
        supplierRequired: t("accounting.dailyIncome.form.validation.supplierRequired"),
      }),
    [t],
  );

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...initialValues, transactionType },
  });

  useEffect(() => {
    reset({ ...initialValues, transactionType });
    setSourceAccountDefaultCleared(false);
  }, [initialValues, reset, transactionType]);

  useEffect(() => {
    if (!focusSecondFieldSignal) return;
    const fieldId = getTransactionFormSecondFieldId(transactionType);
    const timer = window.setTimeout(() => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      field.focus();
      if (field instanceof HTMLInputElement) {
        field.select();
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusSecondFieldSignal, transactionType]);

  const type = watch("transactionType");
  const employeeId = watch("employeeId");
  const employeeName = watch("employeeName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const assigneeSource = watch("assigneeSource");
  const invoiceId = watch("invoiceId");
  const invoiceNumber = watch("invoiceNumber");
  const accountId = watch("accountId");
  const accountName = watch("accountName");
  const paymentAccountId = watch("paymentAccountId");
  const paymentAccountName = watch("paymentAccountName");
  const sourceAccountId = watch("sourceAccountId");
  const sourceAccountName = watch("sourceAccountName");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const isZelle = isZellePaymentMethod(paymentMethodName);
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const selectedInvoice = invoiceId ? invoices.find((item) => item.invoiceId === invoiceId) : undefined;
  const expenseAccounts = useMemo(() => accounts.filter((account) => account.type === "EXPENSE"), [accounts]);
  const revenueAccounts = useMemo(() => accounts.filter(isUserRevenueAccount), [accounts]);
  const expenseSourceAccounts = useMemo(() => accounts.filter((account) => account.type === "ASSET"), [accounts]);
  const accountSelectAccounts = type === "EXPENSE" ? expenseAccounts : type === "SALES" ? revenueAccounts : accounts;
  const sourceAccountSelectAccounts = type === "EXPENSE" ? expenseSourceAccounts : accounts;
  const accountOptions = useMemo(
    () =>
      withPinnedSelectOption(
        accountSelectAccounts.map((account) => ({
          value: String(account.id),
          label: account.displayName,
          keywords: [account.displayName],
        })),
        accountId,
        accountName,
      ),
    [accountId, accountName, accountSelectAccounts],
  );
  const sourceAccountOptions = useMemo(
    () =>
      withPinnedSelectOption(
        sourceAccountSelectAccounts.map((account) => ({
          value: String(account.id),
          label: account.displayName,
          keywords: [account.displayName],
        })),
        sourceAccountId,
        sourceAccountName,
      ),
    [sourceAccountId, sourceAccountName, sourceAccountSelectAccounts],
  );
  const bankAccountOptions = useMemo(
    () =>
      withPinnedSelectOption(
        [
          { value: "", label: t("accounting.dailyIncome.form.placeholders.selectBankAccount") },
          ...bankAccounts.map((account) => ({
            value: String(account.id),
            label: account.displayName,
            keywords: [account.displayName],
          })),
        ],
        paymentAccountId,
        paymentAccountName,
      ),
    [bankAccounts, paymentAccountId, paymentAccountName, t],
  );
  const paymentMethodOptions = useMemo(
    () =>
      withPinnedSelectOption(
        paymentMethods.map((method) => ({
          value: String(method.id),
          label: method.name,
          keywords: [method.name],
        })),
        paymentMethodId,
        paymentMethodName,
      ),
    [paymentMethodId, paymentMethodName, paymentMethods],
  );
  const invoiceOptions = useMemo(
    () =>
      withPinnedSelectOption(
        invoices.map((invoice) => {
          const primaryReceiver = getInvoicePrimaryReceiver(invoice);
          const phones = [...(invoice.sender?.phones ?? []), ...(primaryReceiver?.phones ?? [])];
          const phoneKeywords = phones.flatMap((phone) =>
            [phone.number, phone.displayNumber].filter((value): value is string => Boolean(value)),
          );
          const descriptionLines = [
            invoice.sender?.name
              ? t("accounting.dailyIncome.form.invoiceSummary.sender", { name: invoice.sender.name })
              : null,
            primaryReceiver?.name
              ? t("accounting.dailyIncome.form.invoiceSummary.receiver", { name: primaryReceiver.name })
              : null,
          ].filter((line): line is string => Boolean(line));
          return {
            value: invoice.invoiceId,
            label: invoice.invoiceNumber,
            descriptionLines,
            keywords: [
              invoice.invoiceNumber,
              invoice.sender?.name ?? "",
              primaryReceiver?.name ?? "",
              ...phoneKeywords,
            ].filter(Boolean),
          };
        }),
        invoiceId,
        invoiceNumber,
      ),
    [invoiceId, invoiceNumber, invoices, t],
  );
  const needsExistingInvoice = ["PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type);
  const isRegisterInvoice = type === "INITIAL-PAYMENT";
  const isInventoryChange = type === "INVENTORY";
  const needsAccount = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(type);
  const needsPaymentMethod = needsExistingInvoice || isRegisterInvoice || type === "SALES";
  const needsSourceAccount = type === "TRANSFER" || type === "EXPENSE" || type === "LOAN";

  useEffect(() => {
    if (!needsPaymentMethod || paymentMethods.length === 0) return;
    const matched = matchPaymentMethod(paymentMethods, paymentMethodId, paymentMethodName);
    if (matched) {
      if (matched.id === paymentMethodId && matched.name === paymentMethodName) return;
      setValue("paymentMethodId", matched.id, { shouldValidate: true });
      setValue("paymentMethodName", matched.name, { shouldValidate: true });
      return;
    }
    if (paymentMethodId || paymentMethodName?.trim()) return;
    const cash = findCashPaymentMethod(paymentMethods);
    if (!cash) return;
    setValue("paymentMethodId", cash.id, { shouldValidate: true });
    setValue("paymentMethodName", cash.name, { shouldValidate: true });
  }, [needsPaymentMethod, paymentMethodId, paymentMethodName, paymentMethods, setValue]);

  useEffect(() => {
    if (!needsBankAccount || paymentAccountId || !bankAccounts[0]) return;
    const account = bankAccounts[0];
    setValue("paymentAccountId", account.id, { shouldValidate: true });
    setValue("paymentAccountName", account.displayName);
    setValue("paymentAccountType", account.type);
  }, [bankAccounts, needsBankAccount, paymentAccountId, setValue]);

  useEffect(() => {
    if (type !== "EXPENSE" || expenseSourceAccounts.length === 0) return;
    if (sourceAccountDefaultCleared) return;
    if (sourceAccountId) return;

    const account = expenseSourceAccounts.find(isCashAccount) ?? expenseSourceAccounts[0];
    setValue("sourceAccountId", account.id, { shouldValidate: true });
    setValue("sourceAccountName", account.displayName);
    setValue("sourceAccountType", account.type);
  }, [expenseSourceAccounts, setValue, sourceAccountDefaultCleared, sourceAccountId, type]);

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(async (values) => {
        if (values.transactionType === "INVENTORY") {
          const item = values.inventoryItemName?.trim() || values.inventoryItemId || "";
          const quantity = values.inventoryQuantity ?? 0;
          const autoDescription =
            values.inventoryDirection === "received"
              ? values.inventorySupplierName?.trim()
                ? t("accounting.dailyIncome.form.inventory.receivedDescription", {
                    item,
                    quantity,
                    supplier: values.inventorySupplierName.trim(),
                  })
                : t("accounting.dailyIncome.form.inventory.receivedDescriptionNoSupplier", { item, quantity })
              : t("accounting.dailyIncome.form.inventory.dispatchedDescription", { item, quantity });
          const finalized = finalizeInventoryChangeJournal(
            { ...values, description: values.description.trim() || autoDescription },
            { accounts, paymentMethods },
          );
          await onSubmit(finalized);
          await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          return;
        }
        await onSubmit(values);
      })}
      onKeyDown={handleEnterNavigation}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden", isPhone && "bg-background")}
    >
      <FormBody
        className={cn(
          isPhone &&
            "space-y-5 overflow-x-hidden bg-background px-4 py-5 [&_input]:h-12 [&_input]:rounded-xl [&_input]:text-base [&_label]:text-base [&_textarea]:min-h-28 [&_textarea]:rounded-xl [&_textarea]:text-base",
        )}
      >
        {showTypeSummary && isPhone ? (
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-normal text-foreground">{typeOption.label}</h2>
            <p className="text-base text-muted-foreground">{typeOption.description}</p>
          </div>
        ) : showTypeSummary ? (
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-card px-4 py-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                typeOption.iconBackgroundClassName,
              )}
            >
              <TypeIcon className={cn("size-4", typeOption.iconClassName)} />
            </span>
            <div>
              <p className="text-sm font-semibold">{typeOption.label}</p>
              <p className="text-xs text-muted-foreground">{typeOption.description}</p>
            </div>
          </div>
        ) : null}

        <FormSection title={typeOption.sectionTitle} required className={cn(isPhone && "space-y-4")}>
          {isRegisterInvoice ? (
            <RegisterInvoiceTransactionFields
              employees={employees}
              dailyRoutes={dailyRoutes}
              statementDate={statementDate}
              allowDailyRoute
              bankAccounts={bankAccounts}
              paymentMethods={paymentMethods}
              errors={errors}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ) : isInventoryChange ? (
            <RegisterInventoryChangeFields
              employees={employees}
              dailyRoutes={dailyRoutes}
              statementDate={statementDate}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {type === "PAYMENT" ? (
              <div className="sm:col-span-2">
                <TransactionAssigneeSelect
                  employees={employees}
                  dailyRoutes={dailyRoutes}
                  statementDate={statementDate}
                  employeeId={employeeId}
                  employeeName={employeeName}
                  routeId={routeId}
                  routeName={routeName}
                  assigneeSource={assigneeSource}
                  error={errors.employeeId?.message ?? errors.routeId?.message}
                  setValue={setValue}
                />
              </div>
            ) : null}

            {needsExistingInvoice ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="journal-invoice">{t("accounting.dailyIncome.form.fields.invoice")}</RequiredLabel>
                <SearchableSelect
                  id="journal-invoice"
                  value={invoiceId ?? ""}
                  onValueChange={(next) => {
                    const invoice = invoices.find((item) => item.invoiceId === next);
                    setValue("invoiceId", invoice?.invoiceId ?? "", { shouldValidate: true });
                    setValue("invoiceNumber", invoice?.invoiceNumber ?? "");
                    setValue(
                      "invoiceBalance",
                      invoice ? getInvoiceBalanceAmount(invoice) : undefined,
                      { shouldValidate: true },
                    );
                  }}
                  placeholder={t("accounting.dailyIncome.form.placeholders.selectInvoice")}
                  searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchInvoices")}
                  mobileSheet
                  options={invoiceOptions}
                />
                {errors.invoiceId ? (
                  <p className="text-sm text-destructive">{errors.invoiceId.message}</p>
                ) : null}
                {selectedInvoice ? (
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-blue-100 bg-card px-3 py-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.total")}</p>
                      <p className="font-medium">{formatAccountingMoney(getInvoiceTotal(selectedInvoice))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.discount")}</p>
                      <p className="font-medium">{formatAccountingMoney(selectedInvoice.discount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.paid")}</p>
                      <p className="font-medium">{formatAccountingMoney(selectedInvoice.amountPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.balance")}</p>
                      <p className="font-medium">{formatAccountingMoney(getInvoiceBalanceAmount(selectedInvoice))}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {type !== "PAYMENT" ? (
              <div className="sm:col-span-2">
                <TransactionAssigneeSelect
                  employees={employees}
                  dailyRoutes={dailyRoutes}
                  statementDate={statementDate}
                  employeeId={employeeId}
                  employeeName={employeeName}
                  routeId={routeId}
                  routeName={routeName}
                  assigneeSource={assigneeSource}
                  error={errors.employeeId?.message ?? errors.routeId?.message}
                  setValue={setValue}
                />
              </div>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              {needsPaymentMethod ? (
                <RequiredLabel htmlFor="journal-payment">{t("accounting.dailyIncome.form.fields.paymentMethod")}</RequiredLabel>
              ) : (
                <Label htmlFor="journal-payment">{t("accounting.dailyIncome.form.fields.paymentMethod")}</Label>
              )}
              <SearchableSelect
                id="journal-payment"
                value={paymentMethodId != null ? String(paymentMethodId) : ""}
                onValueChange={(next) => {
                  const method = paymentMethods.find((item) => item.id === Number(next));
                  setValue("paymentMethodId", method?.id, { shouldValidate: true });
                  setValue("paymentMethodName", method?.name ?? "", { shouldValidate: true });
                  if (!isZellePaymentMethod(method?.name)) {
                    setValue("zelleTransactionDate", undefined, { shouldValidate: true });
                    setValue("zelleTransactionName", undefined, { shouldValidate: true });
                  }
                  if (!isCheckPaymentMethod(method?.name)) {
                    setValue("checkNumber", undefined, { shouldValidate: true });
                  }
                }}
                placeholder={t("accounting.dailyIncome.form.placeholders.selectPaymentMethod")}
                searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchPaymentMethods")}
                mobileSheet
                options={paymentMethodOptions}
              />
              {errors.paymentMethodId ? (
                <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
              ) : null}
            </div>

            {needsBankAccount ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="journal-bank-account">{t("accounting.dailyIncome.form.fields.bankAccount")}</RequiredLabel>
                <SearchableSelect
                  id="journal-bank-account"
                  value={paymentAccountId != null ? String(paymentAccountId) : ""}
                  onValueChange={(next) => {
                    const account = bankAccounts.find((item) => item.id === Number(next));
                    setValue("paymentAccountId", account?.id, { shouldValidate: true });
                    setValue("paymentAccountName", account?.displayName ?? "");
                    setValue("paymentAccountType", account?.type);
                  }}
                  placeholder={t("accounting.dailyIncome.form.placeholders.selectBankAccount")}
                  searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchBankAccounts")}
                  mobileSheet
                  options={bankAccountOptions}
                />
                {errors.paymentAccountId ? <p className="text-sm text-destructive">{errors.paymentAccountId.message}</p> : null}
              </div>
            ) : null}

            {isZelle ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <RequiredLabel htmlFor="journal-zelle-date">{t("accounting.dailyIncome.form.fields.zelleDate")}</RequiredLabel>
                  <Input id="journal-zelle-date" type="date" {...register("zelleTransactionDate")} />
                  {errors.zelleTransactionDate ? (
                    <p className="text-sm text-destructive">{errors.zelleTransactionDate.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <RequiredLabel htmlFor="journal-zelle-name">
                    {t("accounting.dailyIncome.form.fields.zelleName")}
                  </RequiredLabel>
                  <Input
                    id="journal-zelle-name"
                    placeholder={t("accounting.dailyIncome.form.placeholders.enterZelleName")}
                    {...register("zelleTransactionName")}
                  />
                  {errors.zelleTransactionName ? (
                    <p className="text-sm text-destructive">{errors.zelleTransactionName.message}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {isCheck ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="journal-check-number">
                  {t("accounting.dailyIncome.form.fields.checkNumber")}
                </RequiredLabel>
                <Input
                  id="journal-check-number"
                  placeholder={t("accounting.dailyIncome.form.placeholders.enterCheckNumber")}
                  autoComplete="off"
                  {...register("checkNumber")}
                />
                {errors.checkNumber ? (
                  <p className="text-sm text-destructive">{errors.checkNumber.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("accounting.dailyIncome.form.fields.checkNumberHint")}
                  </p>
                )}
              </div>
            ) : null}

            {needsAccount ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="journal-account">{t("accounting.dailyIncome.form.fields.account")}</RequiredLabel>
                <SearchableSelect
                  id="journal-account"
                  value={accountId != null ? String(accountId) : ""}
                  onValueChange={(next) => {
                    const account = accountSelectAccounts.find((item) => item.id === Number(next));
                    setValue("accountId", account?.id, { shouldValidate: true });
                    setValue("accountName", account?.displayName ?? "");
                    setValue("accountType", account?.type);
                  }}
                  placeholder={t("accounting.dailyIncome.form.placeholders.selectAccount")}
                  searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchAccounts")}
                  selectAllOnFocus
                  mobileSheet
                  options={accountOptions}
                />
                {errors.accountId ? (
                  <p className="text-sm text-destructive">{errors.accountId.message}</p>
                ) : null}
              </div>
            ) : null}

            {needsSourceAccount ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="journal-source">{t("accounting.dailyIncome.form.fields.sourceAccount")}</RequiredLabel>
                <SearchableSelect
                  id="journal-source"
                  value={sourceAccountId != null ? String(sourceAccountId) : ""}
                  onValueChange={(next) => {
                    setSourceAccountDefaultCleared(next === "");
                    const account = sourceAccountSelectAccounts.find((item) => item.id === Number(next));
                    setValue("sourceAccountId", account?.id, { shouldValidate: true });
                    setValue("sourceAccountName", account?.displayName ?? "");
                    setValue("sourceAccountType", account?.type);
                  }}
                  placeholder={t("accounting.dailyIncome.form.placeholders.selectSourceAccount")}
                  searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchAccounts")}
                  selectAllOnFocus
                  mobileSheet
                  options={sourceAccountOptions}
                />
                {errors.sourceAccountId ? (
                  <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel htmlFor="journal-amount">{t("accounting.dailyIncome.form.fields.amount")}</RequiredLabel>
              <Input
                id="journal-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
                {...register("amount", { setValueAs: moneyFormSetValueAs })}
              />
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-reference">{t("accounting.dailyIncome.form.fields.referenceNumber")}</Label>
              <Input
                id="journal-reference"
                placeholder={t("accounting.dailyIncome.form.placeholders.enterReferenceNumber")}
                {...register("refNumber")}
                onKeyDown={submitFormOnEnterKeyDown}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="journal-description">{t("accounting.dailyIncome.form.fields.description")}</Label>
              <textarea
                id="journal-description"
                rows={3}
                placeholder={t("accounting.dailyIncome.form.placeholders.enterDescription")}
                className={cn(selectClassName, "h-auto py-2 bg-card")}
                {...register("description")}
              />
            </div>
          </div>
          )}
        </FormSection>
      </FormBody>
    </form>
  );
}
