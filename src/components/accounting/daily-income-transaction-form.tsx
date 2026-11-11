"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";

import { InvoiceAdjustmentPresetButtons } from "@/components/accounting/invoice-adjustment-preset-buttons";
import { getInvoiceBalanceTextClassName } from "@/components/accounting/invoice-balance-tone";
import { PaymentAutoClearField } from "@/components/accounting/payment-auto-clear-field";
import { TransactionSectionNavigation } from "@/components/accounting/transaction-section-navigation";
import { INLINE_FIELD_ROW_CLASS_NAME } from "@/components/forms/inline-field-row";
import { TransactionReview } from "@/components/accounting/transaction-review";
import { getTransactionFieldStep, getTransactionStepFields, hasPaymentDetailsStep, isExpensePaidByMethod, TRANSACTION_FIELD_IDS, type TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import { applyMoneyAccount, findDefaultCashAccount, isCashAccountSelectable, listCashAccounts, listSelectableBankAccounts, resolveDefaultBankAccount, shouldClearMoneyAccount } from "@/lib/accounting/daily-income/payment-accounts";
import { PaymentAccountSelect } from "@/components/accounting/payment-account-select";
import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { RegisterInventoryChangeFields } from "@/components/accounting/register-inventory-change-fields";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { TransactionReferenceNumberFields } from "@/components/accounting/transaction-reference-number-fields";
import { TransactionTypeSummary } from "@/components/accounting/transaction-type-summary";
import { FieldMessage } from "@/components/forms/field-message";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { focusWithoutOpeningCombobox, getNavigableFormFields, isDesktopFormNavigation, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useScrollFocusedSectionToTop } from "@/hooks/use-scroll-focused-section-to-top";
import { finalizeInventoryChangeJournal } from "@/lib/accounting/daily-income/inventory-change";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { getTransactionTypeOption, getTransactionFormSecondFieldId } from "@/lib/accounting/daily-income/transaction-type-config";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { createDailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import {
  getBalanceAfterDiscount,
  getBalanceAfterSurcharge,
  getDiscountableBalance,
  getSurchargeBaseBalance,
  type InvoiceAdjustmentKind,
  type OriginalInvoiceAdjustment,
} from "@/lib/accounting/daily-income/invoice-adjustment-presets";
import { findCashPaymentMethod, isCashPaymentMethod, isCheckPaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type DailyIncomeRefNumberMode, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import { queryKeys } from "@/lib/query/query-keys";
import type { Employee } from "@/lib/employees/types";
import { getInvoiceBalanceAmount, getInvoicePrimaryReceiver, getInvoiceTotal, type Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

import { CloseoutRolloverDialog } from "./closeout-rollover-dialog";
import { isCloseoutRequired } from "@/lib/accounting/daily-income/closeout-required";

const RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME =
  "w-40 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type Props = {
  summaryContainer?: HTMLElement | null;
  summaryCurrency?: string;
  onValuesChange?: (values: DailyIncomeJournalValues) => void;
  quickEntry?: boolean;
  activeStep?: TransactionFormStep;
  onStepChange?: (step: TransactionFormStep) => void;
  onContinue?: () => void;
  transactionType: JournalTransactionType;
  initialValues: DailyIncomeJournalValues;
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  statementBranchId?: number | null;
  accounts: ChartAccount[];
  bankAccounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  formId: string;
  showTypeSummary?: boolean;
  showSectionNavigation?: boolean;
  appearance?: "default" | "phone";
  focusSecondFieldSignal?: number;
  /** Offer the auto-clear switch (create only). */
  allowAutoClear?: boolean;
  /** Register payment: show the selected invoice's parties and totals as read-only fields. */
  showInvoiceDetails?: boolean;
  /** Edit only: the saved discount, which the discount cap adds back to the invoice balance. */
  originalDiscount?: OriginalInvoiceAdjustment;
  /** Edit only: the saved surcharge, which is taken back out of the balance before recalculating. */
  originalSurcharge?: OriginalInvoiceAdjustment;
  /** When set, the parent shows step validation messages (e.g. in its footer) instead of the form body. */
  onStepErrorChange?: (message: string | null) => void;
  onSubmit: (values: DailyIncomeJournalValues) => void | Promise<void>;
};

/** Payment invoices are found by typing, so autofocus must not pop the list open. */
function focusTransactionField(field: HTMLElement, type: JournalTransactionType) {
  if (type === "PAYMENT" && field.id === TRANSACTION_FIELD_IDS.invoiceId) {
    focusWithoutOpeningCombobox(field);
    return;
  }
  field.focus();
}

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
  quickEntry = false,
  activeStep,
  onStepChange,
  onContinue,
  transactionType,
  initialValues,
  employees,
  dailyRoutes,
  statementDate,
  statementBranchId,
  accounts,
  bankAccounts,
  invoices,
  paymentMethods,
  formId,
  showTypeSummary = false,
  showSectionNavigation = false,
  appearance = "default",
  focusSecondFieldSignal,
  allowAutoClear = false,
  showInvoiceDetails = false,
  originalDiscount,
  originalSurcharge,
  onStepErrorChange,
  onSubmit,
  onValuesChange,
  summaryContainer,
  summaryCurrency,
}: Props) {
  const { t } = useTranslation();
  const initialTransactionType = transactionType;
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingCloseoutValues, setPendingCloseoutValues] = useState<DailyIncomeJournalValues | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isPhone = appearance === "phone";
  const typeOption = getTransactionTypeOption(transactionType, t);
  const handleEnterNavigation = useFormEnterNavigation();
  useScrollFocusedSectionToTop(formRef, showSectionNavigation);
  const [sourceAccountDefaultCleared, setSourceAccountDefaultCleared] = useState(false);
  const schema = useMemo(
    () =>
      createDailyIncomeJournalSchema({
        amountRequired: t("accounting.dailyIncome.form.validation.amountRequired"),
        amountNonNegative: t("accounting.dailyIncome.form.validation.amountNonNegative"),
        amountPositive: t("accounting.dailyIncome.form.validation.amountPositive"),
        refNumberTooLong: t("accounting.dailyIncome.form.validation.refNumberTooLong"),
        refNumberRequired: t("accounting.dailyIncome.form.validation.refNumberRequired"),
        descriptionTooLong: t("accounting.dailyIncome.form.validation.descriptionTooLong"),
        costPositive: t("accounting.dailyIncome.form.validation.costPositive"),
        discountNonNegative: t("accounting.dailyIncome.form.validation.discountNonNegative"),
        discountExceedsTotal: t("accounting.dailyIncome.form.validation.discountExceedsTotal"),
        discountExceedsBalance: t("accounting.dailyIncome.form.validation.discountExceedsBalance"),
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
        supervisorRequired: t("accounting.dailyIncome.form.validation.supervisorRequired"),
        inventoryHoldersRequired: t("accounting.dailyIncome.form.validation.inventoryHoldersRequired"),
      }, { originalDiscount }),
    [originalDiscount, t],
  );

  const {
    formState: { errors },
    handleSubmit,
    trigger,
    getFieldState,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(schema),
    shouldFocusError: !activeStep,
    defaultValues: { ...initialValues, autoGenerateInvoiceNumber: initialValues.autoGenerateInvoiceNumber ?? initialTransactionType === "INITIAL-PAYMENT", transactionType: initialTransactionType },
  });

  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(watch());
    const subscription = watch(() => onValuesChange(watch()));
    return () => subscription.unsubscribe();
  }, [watch, onValuesChange]);

  useEffect(() => {
    onStepErrorChange?.(stepError);
  }, [onStepErrorChange, stepError]);

  useEffect(() => {
    reset({ ...initialValues, autoGenerateInvoiceNumber: initialValues.autoGenerateInvoiceNumber ?? initialTransactionType === "INITIAL-PAYMENT", transactionType: initialTransactionType });
    setSourceAccountDefaultCleared(false);
  }, [initialValues, initialTransactionType, reset]);

  useEffect(() => {
    if (!focusSecondFieldSignal) return;
    const fieldId = getTransactionFormSecondFieldId(initialTransactionType);
    const timer = window.setTimeout(() => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      focusTransactionField(field, initialTransactionType);
      if (field instanceof HTMLInputElement) {
        field.select();
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusSecondFieldSignal, initialTransactionType]);

  // Opening the assignee dropdown on arrival hides the Employee / Daily route choice.
  const skipStepAutofocus = activeStep === "assignment" && initialTransactionType !== "INVENTORY";

  const activeStepRef = useRef(activeStep);
  const advancingStepRef = useRef<TransactionFormStep | null>(null);
  useEffect(() => {
    activeStepRef.current = activeStep;
    advancingStepRef.current = null;
  }, [activeStep]);

  // Selecting the assignee completes the Assignment step, so it advances without pressing Next.
  const continueAfterAssignee = !quickEntry && activeStep === "assignment" && onContinue
    ? () => window.setTimeout(() => {
      if (activeStepRef.current === "assignment") formRef.current?.requestSubmit();
    }, 0)
    : undefined;

  useEffect(() => {
    setStepError(null);
    if (skipStepAutofocus) return;
    const timer = window.setTimeout(() => {
      const form = formRef.current;
      const field = activeStep === "review"
        ? Array.from(form?.elements ?? []).find((element): element is HTMLButtonElement =>
          element instanceof HTMLButtonElement && element.type === "submit" && !element.disabled && element.getClientRects().length > 0,
        )
        : form && getNavigableFormFields(form)[0];
      if (field) focusTransactionField(field, initialTransactionType);

    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeStep, initialTransactionType, skipStepAutofocus]);

  useEffect(() => {
    if (!invalidField || !isDesktopFormNavigation()) return;
    const timer = window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const id = TRANSACTION_FIELD_IDS[invalidField as keyof DailyIncomeJournalValues];
      const field = getNavigableFormFields(form).find((element) =>
        element.id === id || element.getAttribute("name") === invalidField,
      );
      if (!field) return;
      field.focus();
      field.scrollIntoView({ block: "nearest" });
      setInvalidField(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [invalidField, activeStep, errors]);

  const type = watch("transactionType");
  const employeeId = watch("employeeId");
  const employeeName = watch("employeeName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const supervisorId = watch("supervisorId");
  const supervisorName = watch("supervisorName");
  const assigneeSource = watch("assigneeSource");
  const invoiceId = watch("invoiceId");
  const invoiceNumber = watch("invoiceNumber");
  const accountId = watch("accountId");
  const accountName = watch("accountName");
  const paymentAccountId = watch("paymentAccountId");
  const paymentAccountName = watch("paymentAccountName");
  const paymentAccountType = watch("paymentAccountType");
  const sourceAccountId = watch("sourceAccountId");
  const sourceAccountName = watch("sourceAccountName");
  const sourceAccountType = watch("sourceAccountType");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const refNumberMode = watch("refNumberMode");
  const amount = watch("amount");
  const invoiceBalance = watch("invoiceBalance");
  const autoClear = watch("autoClear");
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const selectedInvoice = invoiceId ? invoices.find((item) => item.invoiceId === invoiceId) : undefined;
  const expenseAccounts = useMemo(() => accounts.filter((account) => account.type === "EXPENSE"), [accounts]);
  const revenueAccounts = useMemo(() => accounts.filter(isUserRevenueAccount), [accounts]);
  const expenseSourceAccounts = useMemo(() => accounts.filter((account) => !account.nonPosting && account.type === "ASSET"), [accounts]);
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
  const expensePaidByMethod = isExpensePaidByMethod(type);
  const moneyAccountTarget = expensePaidByMethod ? "sourceAccount" : "paymentAccount";
  const moneyAccountId = expensePaidByMethod ? sourceAccountId : paymentAccountId;
  const moneyAccountName = expensePaidByMethod ? sourceAccountName : paymentAccountName;
  const cashAccounts = useMemo(() => listCashAccounts(accounts), [accounts]);
  const showCashAccount =
    cashAccounts.length > 0 &&
    isCashPaymentMethod(paymentMethodName) &&
    (expensePaidByMethod || isCashAccountSelectable(type, true));
  const selectableBankAccounts = useMemo(() => listSelectableBankAccounts(bankAccounts), [bankAccounts]);
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
  const needsPaymentMethod = needsExistingInvoice || isRegisterInvoice || type === "SALES" || expensePaidByMethod;
  const showPaymentDetails = hasPaymentDetailsStep(type);
  const needsSourceAccount = (type === "TRANSFER" || type === "EXPENSE" || type === "LOAN") && !expensePaidByMethod;
  const showExistingInvoiceDetails = showInvoiceDetails && type === "PAYMENT";
  const showInvoiceParties = type === "DISCOUNT" || type === "SURCHARGE";

  const invoiceSelectRow = (details: React.ReactNode) => (
    <div className={INLINE_FIELD_ROW_CLASS_NAME}>
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
      <FieldMessage error={errors.invoiceId?.message} className="sm:col-start-2" />
      {details ? <div className="min-w-0 sm:col-start-2">{details}</div> : null}
    </div>
  );

  function renderAmountField(labelKey = "accounting.dailyIncome.form.fields.amount", inline = false) {
    return (
      <div className={inline ? "space-y-1" : "space-y-2"}>
        <div className={inline ? "flex items-center justify-between gap-4" : "space-y-2"}>
          <RequiredLabel htmlFor="journal-amount">{t(labelKey)}</RequiredLabel>
          <Input
            id="journal-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
            className={cn(inline && RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME)}
            {...register("amount", { setValueAs: moneyFormSetValueAs })}
          />
        </div>
        <FieldMessage error={errors.amount?.message} className={inline ? "justify-end" : undefined} />
      </div>
    );
  }

  function renderInvoiceAdjustmentAmountField(kind: InvoiceAdjustmentKind) {
    const isDiscount = kind === "DISCOUNT";
    const baseBalance = isDiscount
      ? getDiscountableBalance(invoiceBalance, invoiceId, originalDiscount)
      : getSurchargeBaseBalance(invoiceBalance, invoiceId, originalSurcharge);
    const invoiceTotal = selectedInvoice ? getInvoiceTotal(selectedInvoice) : undefined;
    const balanceAfter = baseBalance == null
      ? null
      : isDiscount
        ? getBalanceAfterDiscount(baseBalance, amount)
        : getBalanceAfterSurcharge(baseBalance, amount);
    const hint = baseBalance == null
      ? t("accounting.dailyIncome.form.adjustmentPresets.selectInvoiceFirst")
      : isDiscount && baseBalance <= 0
        ? t("accounting.dailyIncome.form.adjustmentPresets.noBalance")
        : t(`accounting.dailyIncome.form.adjustmentPresets.balanceAfter.${kind}`, { amount: formatAccountingMoney(balanceAfter ?? 0) });
    const error = errors.amount?.message
      ?? (isDiscount && balanceAfter != null && balanceAfter < 0 ? t("accounting.dailyIncome.form.validation.discountExceedsBalance") : undefined);
    const maxAmount = isDiscount ? baseBalance : undefined;
    return (
      <div className="space-y-4">
        <InvoiceAdjustmentPresetButtons
          key={kind}
          kind={kind}
          inline
          total={invoiceTotal}
          maxAmount={maxAmount}
          amount={amount}
          onSelectAmount={(next) => setValue("amount", next, { shouldDirty: true, shouldValidate: true })}
          onCustomAmount={() => {
            const input = formRef.current?.querySelector<HTMLInputElement>("#journal-amount");
            input?.focus();
            input?.select();
          }}
        />
        <div className={INLINE_FIELD_ROW_CLASS_NAME}>
          <RequiredLabel htmlFor="journal-amount">{t("accounting.dailyIncome.form.fields.amount")}</RequiredLabel>
          <Input
            id="journal-amount"
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount != null && maxAmount > 0 ? maxAmount : undefined}
            placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
            aria-invalid={Boolean(error)}
            className={cn(RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME, "max-sm:w-full sm:justify-self-end")}
            {...register("amount", { setValueAs: moneyFormSetValueAs })}
          />
          <FieldMessage error={error} hint={hint} className="justify-end text-right sm:col-start-2" />
        </div>
      </div>
    );
  }
  const amountField = type === "DISCOUNT" || type === "SURCHARGE" ? renderInvoiceAdjustmentAmountField(type) : renderAmountField();
  const inlineDescription = needsExistingInvoice && !showPaymentDetails;
  const descriptionField = (
    <div className={cn("sm:col-span-2", inlineDescription ? cn(INLINE_FIELD_ROW_CLASS_NAME, "sm:items-start") : "space-y-2")}>
      <Label htmlFor="journal-description" className={inlineDescription ? "sm:pt-2.5" : undefined}>{t("accounting.dailyIncome.form.fields.description")}</Label>
      <textarea
        id="journal-description"
        rows={3}
        placeholder={t("accounting.dailyIncome.form.placeholders.enterDescription")}
        className={cn(selectClassName, "h-auto py-2 bg-card")}
        {...register("description")}
      />
    </div>
  );

  function invoiceDetailsCard(showParties: boolean, showAmounts: boolean) {
    if (!selectedInvoice) return null;
    const detail = (label: string, value: React.ReactNode, className?: string, id?: string) => (
      <div className={cn("min-w-0", showAmounts && showParties && "col-span-2")}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p id={id} className={cn("truncate font-medium", className)}>{value}</p>
      </div>
    );
    const amountDetail = (label: string, amount: number, className?: string) => (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("font-medium tabular-nums", className)}>{formatAccountingMoney(amount)}</p>
      </div>
    );
    return (
      <div className={cn("grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-muted/70 px-3 py-2.5 text-sm", showAmounts && "sm:grid-cols-4")}>
        {showParties ? (
          <>
            {detail(t("accounting.dailyIncome.form.fields.senderClient"), selectedInvoice.sender?.name || t("common.empty.dash"), undefined, "journal-invoice-sender")}
            {detail(t("accounting.dailyIncome.form.fields.receiverClient"), getInvoicePrimaryReceiver(selectedInvoice)?.name || t("common.empty.dash"), undefined, "journal-invoice-receiver")}
          </>
        ) : null}
        {showAmounts ? (
          <>
            {amountDetail(t("accounting.dailyIncome.form.invoiceSummary.total"), getInvoiceTotal(selectedInvoice))}
            {amountDetail(t("accounting.dailyIncome.form.invoiceSummary.discount"), selectedInvoice.discount)}
            {amountDetail(t("accounting.dailyIncome.form.invoiceSummary.paid"), selectedInvoice.amountPaid)}
            {amountDetail(t("accounting.dailyIncome.form.invoiceSummary.balance"), getInvoiceBalanceAmount(selectedInvoice), getInvoiceBalanceTextClassName(getInvoiceBalanceAmount(selectedInvoice)))}
          </>
        ) : null}
      </div>
    );
  }

  function invoiceSummaryRow(id: string, label: string, amount: number | null | undefined, isBalance = false) {
    return (
      <div className={cn("flex items-baseline justify-between gap-4 py-1.5", isBalance && "mt-1.5 border-t border-border pt-3")}>
        <dt className={cn("text-muted-foreground", isBalance && "font-medium text-foreground")}>{label}</dt>
        <dd id={id} className={cn("pr-3 tabular-nums", isBalance ? cn("text-base font-semibold", getInvoiceBalanceTextClassName(amount)) : "font-medium")}>
          {amount == null ? t("common.empty.dash") : formatAccountingMoney(amount)}
        </dd>
      </div>
    );
  }

  useEffect(() => {
    if (!needsPaymentMethod || paymentMethods.length === 0) return;
    if (!showPaymentDetails) {
      const cash = findCashPaymentMethod(paymentMethods);
      if (!cash || (cash.id === paymentMethodId && cash.name === paymentMethodName)) return;
      setValue("paymentMethodId", cash.id, { shouldValidate: true });
      setValue("paymentMethodName", cash.name, { shouldValidate: true });
      return;
    }
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
  }, [needsPaymentMethod, paymentMethodId, paymentMethodName, paymentMethods, setValue, showPaymentDetails]);

  useEffect(() => {
    if (type !== "EXPENSE" || expensePaidByMethod || expenseSourceAccounts.length === 0) return;
    if (sourceAccountDefaultCleared) return;
    if (sourceAccountId) return;

    const account = expenseSourceAccounts.find(isCashAccount) ?? expenseSourceAccounts[0];
    setValue("sourceAccountId", account.id, { shouldValidate: true });
    setValue("sourceAccountName", account.displayName);
    setValue("sourceAccountType", account.type);
  }, [expensePaidByMethod, expenseSourceAccounts, setValue, sourceAccountDefaultCleared, sourceAccountId, type]);

  useEffect(() => {
    if (!showPaymentDetails || moneyAccountId) return;
    const account = needsBankAccount
      ? resolveDefaultBankAccount(bankAccounts)
      : showCashAccount
        ? findDefaultCashAccount(cashAccounts)
        : undefined;
    if (account) applyMoneyAccount(setValue, moneyAccountTarget, account);
  }, [bankAccounts, cashAccounts, moneyAccountId, moneyAccountTarget, needsBankAccount, setValue, showCashAccount, showPaymentDetails]);

  async function submitEntry(values: DailyIncomeJournalValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (!isCloseoutRequired(error)) throw error;
      setPendingCloseoutValues(structuredClone(values));
    }
  }
  const submitTransaction = handleSubmit(async (values) => {
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
      await submitEntry(finalized);
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      return;
    }
    await submitEntry(values);
  }, (validationErrors) => {
    const field = Object.keys(validationErrors)[0];
    if (field) {
      setInvalidField(field);
      if (!quickEntry) onStepChange?.(getTransactionFieldStep(field, type));
    }
  });

  return (
    <>
    {summaryContainer ? createPortal(<TransactionReview values={watch()} compact currency={summaryCurrency} />, summaryContainer) : null}
    <form
      id={formId}
      ref={formRef}
      noValidate
      data-form-autofocus={skipStepAutofocus ? "off" : undefined}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!quickEntry && activeStep && activeStep !== "review") {
          // An auto-advance and an Enter/Next submit can overlap; only one may leave the step.
          if (advancingStepRef.current === activeStep) return;
          advancingStepRef.current = activeStep;
          const fields = getTransactionStepFields(activeStep, type);
          const valid = await trigger(fields, { shouldFocus: true });
          if (valid) {
            setStepError(null);
            onContinue?.();
          } else {
            advancingStepRef.current = null;
            setInvalidField(fields.find((field) => getFieldState(field).error) ?? null);
            const firstError = fields.map((field) => getFieldState(field).error).find(Boolean);
            setStepError(firstError?.message ?? null);
          }
          return;
        }
        await submitTransaction(event);
      }}
      onKeyDown={handleEnterNavigation}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden", isPhone && "bg-background")}
    >
      {showSectionNavigation ? <TransactionSectionNavigation formRef={formRef} title={t(`accounting.dailyIncome.wizard.typeSelector.options.${transactionType}`)} /> : null}
      <FormBody
        workflow={!isPhone && activeStep !== "review"}
        className={cn(
          isPhone &&
          "space-y-5 overflow-x-hidden bg-background px-4 py-5 [&_input]:h-12 [&_input]:rounded-xl [&_input]:text-base [&_label]:text-base [&_textarea]:min-h-28 [&_textarea]:rounded-xl [&_textarea]:text-base",
        )}
      >
        {stepError && !onStepErrorChange ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{stepError}</p> : null}
        {showTypeSummary && isPhone ? (
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-normal text-foreground">{typeOption.label}</h2>
            <p className="text-base text-muted-foreground">{typeOption.description}</p>
          </div>
        ) : showTypeSummary ? (
          <TransactionTypeSummary type={transactionType} />
        ) : null}

        {activeStep === "review" ? <TransactionReview values={watch()} onEdit={onStepChange} /> : null}
        {isRegisterInvoice ? (
          <RegisterInvoiceTransactionFields
            grouped
            manualInvoiceTotals
            showDescription
            quickEntry={quickEntry}
            activeStep={activeStep}
            employees={employees}
            dailyRoutes={dailyRoutes}
            statementDate={statementDate}
            statementBranchId={statementBranchId}
            allowDailyRoute
            allowAutoClear={allowAutoClear}
            accounts={accounts}
            bankAccounts={bankAccounts}
            paymentMethods={paymentMethods}
            errors={errors}
            register={register}
            setValue={setValue}
            watch={watch}
            trigger={trigger}
            onAssigneeComplete={continueAfterAssignee}
          />
        ) : isInventoryChange ? (
          <RegisterInventoryChangeFields
            activeStep={activeStep}
            dailyRoutes={dailyRoutes}
            statementDate={statementDate}
            statementBranchId={statementBranchId}
            allowAutoReconcile={allowAutoClear}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />
        ) : (
          <div className="space-y-5">
            <FormSection className={activeStep && activeStep !== "assignment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.assignment")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TransactionAssigneeSelect
                    singleColumn
                    employees={employees}
                    dailyRoutes={dailyRoutes}
                    statementDate={statementDate}
                    statementBranchId={statementBranchId}
                    employeeId={employeeId}
                    employeeName={employeeName}
                    routeId={routeId}
                    routeName={routeName}
                    supervisorId={supervisorId}
                    supervisorName={supervisorName}
                    assigneeSource={assigneeSource}
                    error={errors.employeeId?.message ?? errors.routeId?.message}
                    supervisorError={errors.supervisorId?.message}
                    setValue={setValue}
                    onAssigneeComplete={continueAfterAssignee}
                  />
                </div>

              </div>
            </FormSection>
            {showExistingInvoiceDetails ? (
              <>
                <FormSection className={activeStep && activeStep !== "amounts" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceDetails")}>
                  {invoiceSelectRow(invoiceDetailsCard(true, false))}
                </FormSection>
                <FormSection className={activeStep && activeStep !== "amounts" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceAmount")}>
                  <div className="space-y-4">
                    <dl className="min-w-0 text-sm">
                      {invoiceSummaryRow("journal-invoice-total", t("accounting.dailyIncome.form.invoiceSummary.total"), selectedInvoice ? getInvoiceTotal(selectedInvoice) : null)}
                      {invoiceSummaryRow("journal-invoice-discount", t("accounting.dailyIncome.form.invoiceSummary.discount"), selectedInvoice?.discount ?? null)}
                      {invoiceSummaryRow("journal-invoice-paid", t("accounting.dailyIncome.form.invoiceSummary.paid"), selectedInvoice?.amountPaid ?? null)}
                      {invoiceSummaryRow("journal-invoice-balance", t("accounting.dailyIncome.form.invoiceSummary.balance"), selectedInvoice ? getInvoiceBalanceAmount(selectedInvoice) : null, true)}
                    </dl>
                    {renderAmountField("accounting.dailyIncome.form.fields.paymentAmount", true)}
                  </div>
                </FormSection>
              </>
            ) : (
            <FormSection className={activeStep && activeStep !== "amounts" ? "hidden" : undefined} variant="card" title={t(needsExistingInvoice ? "accounting.dailyIncome.form.sections.invoiceDetails" : "accounting.dailyIncome.form.sections.amounts")}>
              <div className="grid gap-4 sm:grid-cols-2">
                {needsExistingInvoice ? (
                  <div className="min-w-0 sm:col-span-2">
                    {invoiceSelectRow(invoiceDetailsCard(showInvoiceParties, true))}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:col-span-2">
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
                      <FieldMessage error={errors.accountId?.message} hint={type === "EXPENSE" ? t("accounting.dailyIncome.form.hints.expenseAccount") : undefined} />
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
                      <FieldMessage error={errors.sourceAccountId?.message} hint={t("accounting.dailyIncome.form.hints.sourceAccount")} />
                    </div>
                  ) : null}

                  {amountField}
                </div>

                {showPaymentDetails ? null : descriptionField}
              </div>
            </FormSection>
            )}
            {showPaymentDetails ? (
            <FormSection className={activeStep && activeStep !== "payment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.paymentDetails")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0 sm:col-span-2">
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
                      const nextNeedsBank = requiresBankAccount(method?.name);
                      if (expensePaidByMethod) {
                        if (shouldClearMoneyAccount(nextNeedsBank, sourceAccountType)) applyMoneyAccount(setValue, "sourceAccount", undefined);
                      } else if (!nextNeedsBank || paymentAccountType !== "BANK") {
                        setValue("paymentAccountId", undefined, { shouldValidate: true });
                        setValue("paymentAccountName", undefined, { shouldValidate: true });
                        setValue("paymentAccountType", undefined, { shouldValidate: true });
                      }
                      if (isCheckPaymentMethod(method?.name) || isCashPaymentMethod(method?.name)) {
                        setValue("externalReferenceNumber", "", { shouldValidate: true });
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
                  <FieldMessage error={errors.paymentMethodId?.message} />
                </div>

                {needsBankAccount ? (
                  <PaymentAccountSelect
                    id={expensePaidByMethod ? "journal-source" : "journal-bank-account"}
                    kind="bank"
                    className="space-y-2 min-w-0 sm:col-start-1"
                    accounts={selectableBankAccounts}
                    pathSource={bankAccounts}
                    value={moneyAccountId}
                    valueName={moneyAccountName}
                    label={expensePaidByMethod ? t("accounting.dailyIncome.form.fields.expenseBankAccount") : undefined}
                    required
                    error={expensePaidByMethod ? errors.sourceAccountId?.message : errors.paymentAccountId?.message}
                    onChange={(account) => applyMoneyAccount(setValue, moneyAccountTarget, account)}
                  />
                ) : showCashAccount ? (
                  <PaymentAccountSelect
                    id={expensePaidByMethod ? "journal-source" : "journal-cash-account"}
                    kind="cash"
                    className="space-y-2 min-w-0 sm:col-start-1"
                    accounts={cashAccounts}
                    pathSource={accounts}
                    value={moneyAccountId}
                    valueName={moneyAccountName}
                    label={expensePaidByMethod ? t("accounting.dailyIncome.form.fields.expenseCashAccount") : undefined}
                    required={expensePaidByMethod}
                    error={expensePaidByMethod ? errors.sourceAccountId?.message : undefined}
                    hint={expensePaidByMethod ? null : t("accounting.dailyIncome.form.hints.cashAccount")}
                    onChange={(account) => applyMoneyAccount(setValue, moneyAccountTarget, account)}
                  />
                ) : null}

                {isCheck ? (
                  <div className="space-y-2 min-w-0">
                    <RequiredLabel htmlFor="journal-check-number">
                      {t("accounting.dailyIncome.form.fields.checkNumber")}
                    </RequiredLabel>
                    <Input
                      id="journal-check-number"
                      placeholder={t("accounting.dailyIncome.form.placeholders.enterCheckNumber")}
                      autoComplete="off"
                      {...register("checkNumber")}
                    />
                    <FieldMessage error={errors.checkNumber?.message} hint={t("accounting.dailyIncome.form.fields.checkNumberHint")} />
                  </div>
                ) : null}

                {!isCheck && !isCashPaymentMethod(paymentMethodName) ? <div className="space-y-2 min-w-0">
                  <Label htmlFor="journal-external-reference">{t("accounting.dailyIncome.form.fields.externalReferenceNumber")}</Label>
                  <Input
                    id="journal-external-reference"
                    autoComplete="off"
                    placeholder={t("accounting.dailyIncome.form.placeholders.externalReferenceNumber")}
                    {...register("externalReferenceNumber")}
                  />
                  <FieldMessage hint={t("accounting.dailyIncome.form.fields.externalReferenceHint")} />
                </div> : null}

                {allowAutoClear ? (
                  <PaymentAutoClearField
                    transactionType={type}
                    amount={amount}
                    paymentMethodName={paymentMethodName}
                    checked={Boolean(autoClear)}
                    onCheckedChange={(checked) => setValue("autoClear", checked, { shouldDirty: true })}
                  />
                ) : null}

                <TransactionReferenceNumberFields
                  mode={refNumberMode}
                  refNumberRegister={register("refNumber")}
                  error={errors.refNumber?.message}
                  onModeChange={(mode: DailyIncomeRefNumberMode) => {
                    setValue("refNumberMode", mode, { shouldValidate: true });
                    if (mode === "system") {
                      setValue("refNumber", "", { shouldValidate: true });
                    }
                  }}
                />

                {descriptionField}
              </div>
            </FormSection>
            ) : null}
          </div>
        )}
        {allowAutoClear && isInventoryChange && (!activeStep || activeStep === "review") ? <PaymentAutoClearField
          transactionType={type} amount={amount} paymentMethodName={paymentMethodName}
          checked={Boolean(autoClear)} onCheckedChange={checked => setValue("autoClear", checked, {shouldDirty: true})}
        /> : null}
      </FormBody>
    </form>
    {pendingCloseoutValues != null ? (
      <CloseoutRolloverDialog
        open
        onOpenChange={(open) => { if (!open) setPendingCloseoutValues(null); }}
        onReady={async () => {
          const values = pendingCloseoutValues;
          setPendingCloseoutValues(null);
          if (values) await submitEntry(values);
        }}
      />
    ) : null}
    </>
  );
}
