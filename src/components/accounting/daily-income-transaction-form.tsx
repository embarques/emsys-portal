"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

import { InvoiceAdjustmentPresetButtons } from "@/components/accounting/invoice-adjustment-preset-buttons";
import { getInvoiceBalanceTextClassName } from "@/components/accounting/invoice-balance-tone";
import { PaymentAutoClearField } from "@/components/accounting/payment-auto-clear-field";
import { TransactionSectionNavigation } from "@/components/accounting/transaction-section-navigation";
import { INLINE_FIELD_ROW_CLASS_NAME } from "@/components/forms/inline-field-row";
import { TransactionReview } from "@/components/accounting/transaction-review";
import { getTransactionFieldStep, getTransactionStepHintKey, getTransactionStepFields, getTransactionStepLabelKey, hasPaymentDetailsStep, isExpensePaidByMethod, isFixedCashTransactionType, TRANSACTION_FIELD_IDS, type TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import { applyMoneyAccount, buildPaymentAccountOptions, findDefaultCashAccount, isCashAccountSelectable, listCashAccounts, listExpenseSourceAccounts, listSelectableBankAccounts, resolveDefaultBankAccount, shouldClearMoneyAccount } from "@/lib/accounting/daily-income/payment-accounts";
import { PaymentAccountSelect } from "@/components/accounting/payment-account-select";
import { PaymentChannelFields } from "@/components/accounting/payment-channel-fields";
import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { RegisterInventoryChangeFields } from "@/components/accounting/register-inventory-change-fields";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { useTransactionAssigneeEntityActions } from "@/components/accounting/use-transaction-assignee-entity-actions";
import { TransactionReferenceNumberFields } from "@/components/accounting/transaction-reference-number-fields";
import { TransactionTypeSummary } from "@/components/accounting/transaction-type-summary";
import { FieldMessage } from "@/components/forms/field-message";
import { FormBody, FormFooterNoticeMessage, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
  isSameMoneyAmount,
  type InvoiceAdjustmentKind,
  type OriginalInvoiceAdjustment,
} from "@/lib/accounting/daily-income/invoice-adjustment-presets";
import { findCashPaymentMethod, isCashPaymentMethod, isCheckPaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type DailyIncomeRefNumberMode, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import { isBankTransaction } from "@/lib/accounting/daily-income/auto-clear";
import { getInvoicePaymentBalancePreview } from "@/lib/accounting/daily-income/invoice-balance-preview";
import { queryKeys } from "@/lib/query/query-keys";
import type { Employee } from "@/lib/employees/types";
import { useInvoiceSearch } from "@/lib/invoices/hooks/use-invoices";
import { createInvoiceSearchFilter, getInvoiceBalanceAmount, getInvoicePrimaryReceiver, getInvoiceTotal, type Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

import { CloseoutRolloverDialog } from "./closeout-rollover-dialog";
import { isCloseoutRequired } from "@/lib/accounting/daily-income/closeout-required";

const RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME =
  "w-40 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const CREATE_NEW_INVOICE_VALUE = "__create-new-invoice__";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type Props = {
  summaryContainer?: HTMLElement | null;
  summaryCurrency?: string;
  onValuesChange?: (values: DailyIncomeJournalValues) => void;
  /** Create-only: Payment can search an existing invoice or create a new one. */
  invoiceDiscovery?: boolean;
  /** Keep the wizard journal type in sync when discovery switches new ↔ existing. */
  onTransactionTypeChange?: (type: JournalTransactionType) => void;
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
  /** Section navigation: return to the transaction type step. */
  onChangeType?: () => void;
  changeTypeDisabled?: boolean;
  /** Guided wizard: back control beside the step title (same pattern as the type picker). */
  onStepBack?: () => void;
  stepBackDisabled?: boolean;
  appearance?: "default" | "phone";
  focusSecondFieldSignal?: number;
  /** When false, the form mounts without moving focus into any field. */
  autoFocusOnMount?: boolean;
  /** Offer the auto-clear switch (create only). */
  allowAutoClear?: boolean;
  /** Register payment: show the selected invoice's parties and totals as read-only fields. */
  showInvoiceDetails?: boolean;
  /** Edit only: the saved discount, which the discount cap adds back to the invoice balance. */
  originalDiscount?: OriginalInvoiceAdjustment;
  /** Edit only: the saved surcharge, which is taken back out of the balance before recalculating. */
  originalSurcharge?: OriginalInvoiceAdjustment;
  /** Edit only: a saved payment already applied to this invoice. */
  originalPayment?: OriginalInvoiceAdjustment;
  /** When set, the parent shows step validation messages (e.g. in its footer) instead of the form body. */
  onStepErrorChange?: (message: string | null) => void;
  onSubmit: (values: DailyIncomeJournalValues) => void | Promise<void>;
};

/** Invoices and accounts are found by typing, so autofocus must not pop a list open. */
function focusTransactionField(field: HTMLElement) {
  if (field.getAttribute("role") === "combobox") {
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
  invoiceDiscovery = false,
  onTransactionTypeChange,
  activeStep,
  onStepChange,
  onContinue,
  transactionType,
  initialValues,
  employees,
  dailyRoutes = [],
  statementDate,
  statementBranchId,
  accounts,
  bankAccounts,
  invoices,
  paymentMethods,
  formId,
  showTypeSummary = false,
  showSectionNavigation = false,
  onChangeType,
  changeTypeDisabled = false,
  onStepBack,
  stepBackDisabled = false,
  appearance = "default",
  focusSecondFieldSignal,
  autoFocusOnMount = true,
  allowAutoClear = false,
  showInvoiceDetails = false,
  originalDiscount,
  originalSurcharge,
  originalPayment,
  onStepErrorChange,
  onSubmit,
  onValuesChange,
  summaryContainer,
  summaryCurrency,
}: Props) {
  const { t } = useTranslation();
  const initialTransactionType = transactionType;
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const autofocusEffectRanRef = useRef(false);
  const [pendingCloseoutValues, setPendingCloseoutValues] = useState<DailyIncomeJournalValues | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isPhone = appearance === "phone";
  const invoiceDetailLabelClassName = "text-xs font-medium leading-4 text-muted-foreground";
  const typeOption = getTransactionTypeOption(transactionType, t);
  const handleEnterNavigation = useFormEnterNavigation();
  useScrollFocusedSectionToTop(formRef, showSectionNavigation);
  const [sourceAccountDefaultCleared, setSourceAccountDefaultCleared] = useState(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [selectedInvoiceCache, setSelectedInvoiceCache] = useState<Invoice | null>(null);
  const debouncedInvoiceQuery = useDebouncedValue(invoiceQuery.trim(), 300);
  const invoiceSearch = useInvoiceSearch(createInvoiceSearchFilter(debouncedInvoiceQuery), {
    enabled: Boolean(debouncedInvoiceQuery),
    limit: 40,
  });
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
        invoicePaidOff: t("accounting.dailyIncome.form.validation.invoicePaidOff"),
        accountRequired: t("accounting.dailyIncome.form.validation.accountRequired"),
        sourceAccountRequired: t("accounting.dailyIncome.form.validation.sourceAccountRequired"),
        transferSameAccount: t("accounting.dailyIncome.form.validation.transferSameAccount"),
        inventoryRequired: t("accounting.dailyIncome.form.validation.inventoryRequired"),
        inventoryItemRequired: t("accounting.dailyIncome.form.validation.inventoryItemRequired"),
        inventoryQuantityRequired: t("accounting.dailyIncome.form.validation.inventoryQuantityRequired"),
        inventoryPriceRequired: t("accounting.dailyIncome.form.validation.inventoryPriceRequired"),
        supplierRequired: t("accounting.dailyIncome.form.validation.supplierRequired"),
        supervisorRequired: t("accounting.dailyIncome.form.validation.supervisorRequired"),
        inventoryHoldersRequired: t("accounting.dailyIncome.form.validation.inventoryHoldersRequired"),
      }, { originalDiscount, originalPayment }),
    [originalDiscount, originalPayment, t],
  );

  const {
    formState: { errors },
    handleSubmit,
    trigger,
    getFieldState,
    getValues,
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
    setInvoiceQuery("");
    const initialInvoiceId = initialValues.invoiceId?.trim();
    // Keep a just-selected invoice when discovery flips PAYMENT ↔ INITIAL-PAYMENT; the directory
    // list may not include search hits, so do not clear a matching cache entry.
    setSelectedInvoiceCache((current) => {
      if (!initialInvoiceId) return null;
      if (current?.invoiceId === initialInvoiceId) return current;
      return invoices.find((invoice) => invoice.invoiceId === initialInvoiceId) ?? null;
    });
  }, [initialValues, initialTransactionType, invoices, reset]);

  useEffect(() => {
    if (!focusSecondFieldSignal) return;
    const fieldId = getTransactionFormSecondFieldId(initialTransactionType);
    const timer = window.setTimeout(() => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      focusTransactionField(field);
      if (field instanceof HTMLInputElement) {
        field.select();
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusSecondFieldSignal, initialTransactionType]);

  // Opening the assignee dropdown on arrival hides the Employee / Daily route choice.
  const skipStepAutofocus = !autoFocusOnMount || (activeStep === "assignment" && initialTransactionType !== "INVENTORY");

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
    const firstStep = !autofocusEffectRanRef.current;
    autofocusEffectRanRef.current = true;
    if (!autoFocusOnMount && firstStep) return;
    const timer = window.setTimeout(() => {
      const form = formRef.current;
      const field = activeStep === "review" || skipStepAutofocus
        ? form?.querySelector<HTMLElement>("[data-step-heading]")
        : form && getNavigableFormFields(form)[0];
      if (field) focusTransactionField(field);

    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeStep, initialTransactionType, skipStepAutofocus, autoFocusOnMount]);

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
  const assigneeEntityActions = useTransactionAssigneeEntityActions({
    setValue,
    employees,
    dailyRoutes,
    statementDate,
    employeeId,
    routeId,
  });
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
  const clearPaymentOnSave = watch("clearPaymentOnSave");
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const invoiceResults = useMemo(
    () => (debouncedInvoiceQuery ? (invoiceSearch.data?.items ?? []) : invoices),
    [debouncedInvoiceQuery, invoiceSearch.data?.items, invoices],
  );
  const selectedInvoice = useMemo(() => {
    if (!invoiceId) return undefined;
    if (selectedInvoiceCache?.invoiceId === invoiceId) return selectedInvoiceCache;
    return invoiceResults.find((item) => item.invoiceId === invoiceId)
      ?? invoices.find((item) => item.invoiceId === invoiceId);
  }, [invoiceId, invoiceResults, invoices, selectedInvoiceCache]);
  const payableInvoiceBalance = getInvoicePaymentBalancePreview(
    selectedInvoice ? getInvoiceBalanceAmount(selectedInvoice) : invoiceBalance,
    0,
    invoiceId,
    originalPayment,
  ).previousBalance;
  const selectedInvoicePaidOff = type === "PAYMENT" && Boolean(invoiceId) && payableInvoiceBalance != null && payableInvoiceBalance <= 0;
  const expenseAccounts = useMemo(() => accounts.filter((account) => account.type === "EXPENSE"), [accounts]);
  const revenueAccounts = useMemo(() => accounts.filter(isUserRevenueAccount), [accounts]);
  const expenseSourceAccounts = useMemo(() => listExpenseSourceAccounts(accounts), [accounts]);
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
  const isTransfer = type === "TRANSFER";
  const transferPathSource = useMemo(() => [...accounts, ...bankAccounts], [accounts, bankAccounts]);
  const transferAccounts = useMemo(() => {
    const byId = new Map<number, ChartAccount>();
    for (const account of transferPathSource) {
      if ((account.type === "ASSET" || account.type === "BANK") && !account.nonPosting && !byId.has(account.id)) byId.set(account.id, account);
    }
    return [...byId.values()];
  }, [transferPathSource]);
  const transferOptions = (excludeId: number | undefined, value: number | undefined, valueName: string | undefined) =>
    withPinnedSelectOption(buildPaymentAccountOptions(transferAccounts.filter((account) => account.id !== excludeId), transferPathSource), value, valueName);
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
  const allowInvoiceDiscovery = invoiceDiscovery && (type === "PAYMENT" || type === "INITIAL-PAYMENT");
  const creatingDiscoveredInvoice = allowInvoiceDiscovery && type === "INITIAL-PAYMENT";
  const invoiceOptions = useMemo(() => {
    const existing = withPinnedSelectOption(
      invoiceResults.map((invoice) => {
        const primaryReceiver = getInvoicePrimaryReceiver(invoice);
        const phones = [...(invoice.sender?.phones ?? []), ...(primaryReceiver?.phones ?? [])];
        const phoneKeywords = phones.flatMap((phone) =>
          [phone.number, phone.displayNumber].filter((value): value is string => Boolean(value)),
        );
        const balance = getInvoiceBalanceAmount(invoice);
        const descriptionLines = [
          t("accounting.dailyIncome.form.invoiceSummary.balancePreview", {
            amount: formatAccountingMoney(balance),
          }),
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
    );
    if (!allowInvoiceDiscovery) return existing;
    return [
      {
        value: CREATE_NEW_INVOICE_VALUE,
        label: t("accounting.dailyIncome.form.placeholders.createNewInvoice"),
        descriptionLines: [t("accounting.dailyIncome.form.placeholders.createNewInvoiceDescription")],
        keywords: ["new", "create", "nueva", "crear"],
      },
      ...existing,
    ];
  }, [allowInvoiceDiscovery, invoiceId, invoiceNumber, invoiceResults, t]);
  const needsExistingInvoice = ["PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type);
  const isRegisterInvoice = type === "INITIAL-PAYMENT";
  const isInventoryChange = type === "INVENTORY";
  const needsAccount = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(type);
  const needsPaymentMethod = needsExistingInvoice || isRegisterInvoice || type === "SALES" || expensePaidByMethod;
  const showPaymentDetails = hasPaymentDetailsStep(type);
  const needsSourceAccount = (type === "TRANSFER" || type === "EXPENSE" || type === "LOAN") && !expensePaidByMethod;
  const isInvoiceAdjustment = type === "DISCOUNT" || type === "SURCHARGE";
  const showExistingInvoiceDetails =
    ((showInvoiceDetails || allowInvoiceDiscovery) && type === "PAYMENT") || isInvoiceAdjustment;
  const autoGenerateInvoiceNumber = watch("autoGenerateInvoiceNumber");
  const duplicateDiscoveredInvoice = useMemo(() => {
    if (!creatingDiscoveredInvoice || autoGenerateInvoiceNumber) return null;
    const needle = (invoiceNumber ?? "").trim().toLowerCase();
    if (!needle) return null;
    return invoices.find((invoice) => invoice.invoiceNumber.trim().toLowerCase() === needle) ?? null;
  }, [autoGenerateInvoiceNumber, creatingDiscoveredInvoice, invoiceNumber, invoices]);

  function applyExistingInvoice(invoice: Invoice) {
    setSelectedInvoiceCache(invoice);
    setInvoiceQuery("");
    setValue("transactionType", "PAYMENT", { shouldValidate: true, shouldDirty: true });
    setValue("invoiceId", invoice.invoiceId, { shouldValidate: true, shouldDirty: true });
    setValue("invoiceNumber", invoice.invoiceNumber, { shouldValidate: true, shouldDirty: true });
    setValue("autoGenerateInvoiceNumber", undefined);
    setValue("invoiceBalance", getInvoiceBalanceAmount(invoice), { shouldValidate: true, shouldDirty: true });
    setValue("invoiceCost", undefined);
    setValue("invoiceDiscount", undefined);
    setValue("includeSender", false);
    setValue("includeReceiver", false);
    setValue("senderId", undefined);
    setValue("receiverId", undefined);
    // Flush before the wizard syncs type + resets from initialValues.
    onValuesChange?.(getValues());
    onTransactionTypeChange?.("PAYMENT");
  }

  function applyCreateNewInvoice() {
    setSelectedInvoiceCache(null);
    setInvoiceQuery("");
    setValue("transactionType", "INITIAL-PAYMENT", { shouldValidate: true, shouldDirty: true });
    setValue("invoiceId", "", { shouldValidate: true, shouldDirty: true });
    setValue("invoiceNumber", "", { shouldValidate: true, shouldDirty: true });
    setValue("autoGenerateInvoiceNumber", true, { shouldValidate: true, shouldDirty: true });
    setValue("invoiceBalance", undefined);
    setValue("amount", 0, { shouldDirty: true });
    onValuesChange?.(getValues());
    onTransactionTypeChange?.("INITIAL-PAYMENT");
  }

  const invoiceSelectRow = (details: React.ReactNode, stacked = false) => (
    <div className={stacked ? "min-w-0 space-y-1" : INLINE_FIELD_ROW_CLASS_NAME}>
      <RequiredLabel htmlFor="journal-invoice">{t("accounting.dailyIncome.form.fields.invoice")}</RequiredLabel>
      <SearchableSelect
        inlineOptionsLimit={activeStep && !debouncedInvoiceQuery ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
        id="journal-invoice"
        value={creatingDiscoveredInvoice ? CREATE_NEW_INVOICE_VALUE : (invoiceId ?? "")}
        onValueChange={(next) => {
          if (allowInvoiceDiscovery && next === CREATE_NEW_INVOICE_VALUE) {
            applyCreateNewInvoice();
            return;
          }
          const invoice = invoiceResults.find((item) => item.invoiceId === next)
            ?? invoices.find((item) => item.invoiceId === next)
            ?? (selectedInvoiceCache?.invoiceId === next ? selectedInvoiceCache : undefined);
          if (allowInvoiceDiscovery && invoice) {
            applyExistingInvoice(invoice);
            return;
          }
          setSelectedInvoiceCache(invoice ?? null);
          setInvoiceQuery("");
          setValue("invoiceId", invoice?.invoiceId ?? "", { shouldValidate: true });
          setValue("invoiceNumber", invoice?.invoiceNumber ?? "");
          setValue(
            "invoiceBalance",
            invoice ? getInvoiceBalanceAmount(invoice) : undefined,
            { shouldValidate: true },
          );
          if (!invoice) setValue("amount", 0, { shouldDirty: true });
        }}
        onSearchChange={setInvoiceQuery}
        manualFiltering
        loading={Boolean(debouncedInvoiceQuery) && invoiceSearch.isFetching}
        placeholder={t(
          allowInvoiceDiscovery
            ? "accounting.dailyIncome.form.placeholders.selectInvoiceMode"
            : "accounting.dailyIncome.form.placeholders.selectInvoice",
        )}
        searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchInvoices")}
        emptyMessage={
          allowInvoiceDiscovery
            ? t("accounting.dailyIncome.form.placeholders.createNewInvoice")
            : undefined
        }
        mobileSheet
        options={invoiceOptions}
      />
      <FieldMessage error={errors.invoiceId?.message} className="sm:col-start-2" />
      {selectedInvoicePaidOff ? (
        <FormFooterNoticeMessage
          tone="error"
          className="sm:col-start-2"
          message={t("accounting.dailyIncome.form.validation.invoicePaidOff")}
        />
      ) : null}
      {details ? <div className="min-w-0 sm:col-start-2">{details}</div> : null}
    </div>
  );

  function renderAmountField(labelKey = "accounting.dailyIncome.form.fields.amount", inline = false, emphasized = false) {
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
            className={cn((inline || emphasized) && RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME, emphasized && "h-11 w-full text-lg font-semibold md:text-lg")}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={emphasized && errors.amount ? "journal-payment-amount-error" : undefined}
            {...register("amount", { setValueAs: moneyFormSetValueAs })}
          />
        </div>
        {errors.amount ? (
          <div id={emphasized ? "journal-payment-amount-error" : undefined}>
            <FieldMessage error={errors.amount.message} className={inline ? "justify-end" : undefined} />
          </div>
        ) : null}
      </div>
    );
  }

  function renderInvoiceAdjustmentAmountField(kind: InvoiceAdjustmentKind, stacked = false) {
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
        : undefined;
    const error = errors.amount?.message
      ?? (isDiscount && balanceAfter != null && balanceAfter < 0 ? t("accounting.dailyIncome.form.validation.discountExceedsBalance") : undefined);
    const maxAmount = isDiscount ? baseBalance : undefined;
    const presets = (
      <InvoiceAdjustmentPresetButtons
        key={kind}
        kind={kind}
        inline={!stacked}
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
    );
    if (stacked) {
      return renderInvoiceAmountRow(`accounting.dailyIncome.transactionTypes.${isDiscount ? "discount" : "surcharge"}.label`, {
        error,
        hint,
        maxAmount,
        preview: { previousBalance: baseBalance ?? null, newBalance: balanceAfter },
        feedbackId: "journal-adjustment-amount-feedback",
        leading: <div className="border-b border-border pb-3">{presets}</div>,
      });
    }
    return (
      <div className="space-y-4">
        <div>{presets}</div>
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
            aria-describedby="journal-adjustment-amount-feedback"
            className={cn(RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME, "max-sm:w-full sm:justify-self-end")}
            {...register("amount", { setValueAs: moneyFormSetValueAs })}
          />
          <div id="journal-adjustment-amount-feedback" className="sm:col-start-2">
            <FieldMessage error={error} hint={hint} className="justify-end text-right" />
          </div>
        </div>
      </div>
    );
  }
  const amountField = type === "DISCOUNT" || type === "SURCHARGE" ? renderInvoiceAdjustmentAmountField(type) : renderAmountField();
  const descriptionField = (
    <div className="space-y-2">
      <Label htmlFor="journal-description">{t("accounting.dailyIncome.form.fields.notes")}</Label>
      <textarea
        id="journal-description"
        rows={3}
        placeholder={t("accounting.dailyIncome.form.placeholders.enterDescription")}
        className={cn(selectClassName, "h-auto py-2 bg-card")}
        {...register("description")}
      />
      <FieldMessage error={errors.description?.message} />
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

  function invoiceTextRow(id: string, label: string, value: string | null | undefined) {
    return (
      <div className="min-w-0 space-y-1">
        <dt className={invoiceDetailLabelClassName}>{label}</dt>
        <dd id={id} className="break-words text-sm font-semibold leading-5 text-foreground">{value || t("common.empty.dash")}</dd>
      </div>
    );
  }

  function invoiceSummaryRow(id: string, label: string, amount: number | null | undefined, isBalance = false) {
    return (
      <div className="min-w-0 space-y-1">
        <dt className={invoiceDetailLabelClassName}>{label}</dt>
        <dd id={id} className={cn("break-words tabular-nums", isBalance ? cn("text-2xl font-semibold tracking-tight", getInvoiceBalanceTextClassName(amount)) : "text-sm font-semibold leading-5 text-foreground")}>
          {amount == null ? t("common.empty.dash") : formatAccountingMoney(amount)}
        </dd>
      </div>
    );
  }

  function renderInvoiceAmountRow(labelKey: string, options: {
    error?: string;
    hint?: string;
    maxAmount?: number;
    feedbackId?: string;
    preview?: { previousBalance: number | null; newBalance: number | null };
    /** Rendered above the amount (e.g. discount / surcharge presets). */
    leading?: React.ReactNode;
  } = {}) {
    const { error, hint, maxAmount, feedbackId = "journal-payment-amount-error", leading } = options;
    const preview = options.preview ?? getInvoicePaymentBalancePreview(
      selectedInvoice ? getInvoiceBalanceAmount(selectedInvoice) : null,
      amount,
      invoiceId,
      originalPayment,
    );
    const fullBalance = type === "PAYMENT" && preview.previousBalance != null && preview.previousBalance > 0 ? preview.previousBalance : null;
    const fullBalanceActive = fullBalance != null && isSameMoneyAmount(fullBalance, amount);
    const balanceClassName = "break-words text-lg font-semibold tracking-tight tabular-nums md:text-xl";
    return (
      <>
        <div className="min-w-0 space-y-3 p-4">
          {leading}
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <RequiredLabel htmlFor="journal-amount">{t(labelKey)}</RequiredLabel>
            {fullBalance != null ? (
              <Button
                type="button"
                size="sm"
                variant={fullBalanceActive ? "default" : "outline"}
                aria-pressed={fullBalanceActive}
                className="tabular-nums"
                onClick={() => setValue("amount", fullBalance, { shouldDirty: true, shouldValidate: true })}
              >
                {t("accounting.dailyIncome.wizard.quickFlow.fullBalance", { amount: formatAccountingMoney(fullBalance) })}
              </Button>
            ) : null}
          </div>
          <Input
            id="journal-amount"
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount != null && maxAmount > 0 ? maxAmount : undefined}
            placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
            aria-invalid={Boolean(error)}
            aria-describedby={error || hint ? feedbackId : undefined}
            className={cn(RIGHT_ALIGNED_AMOUNT_INPUT_CLASS_NAME, "h-11 w-full text-lg font-semibold md:text-lg")}
            {...register("amount", { setValueAs: moneyFormSetValueAs })}
          />
          {error || hint ? (
            <div id={feedbackId} className="min-w-0">
              <FieldMessage error={error} hint={hint} className="justify-end text-right" />
            </div>
          ) : null}
        </div>
        <div className="space-y-2 border-t border-border bg-muted/35 px-4 py-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <dl className="min-w-0 space-y-1">
              <dt className={invoiceDetailLabelClassName}>{t("accounting.dailyIncome.form.invoiceSummary.previousBalance")}</dt>
              <dd id="journal-invoice-balance" className={cn(balanceClassName, getInvoiceBalanceTextClassName(preview.previousBalance))}>
                {preview.previousBalance == null ? t("common.empty.dash") : formatAccountingMoney(preview.previousBalance)}
              </dd>
            </dl>
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <dl className="min-w-0 space-y-1 text-right">
              <dt className={invoiceDetailLabelClassName}>{t("accounting.dailyIncome.form.invoiceSummary.newBalance")}</dt>
              <dd id="journal-invoice-new-balance" className={cn(balanceClassName, "text-emerald-700 dark:text-emerald-400")}>
                {preview.newBalance == null ? t("common.empty.dash") : formatAccountingMoney(preview.newBalance)}
              </dd>
            </dl>
          </div>
          {type === "PAYMENT" && paymentMethodName && !isCashPaymentMethod(paymentMethodName) && !clearPaymentOnSave ? (
            <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.hints.balanceAfterClearance")}</p>
          ) : null}
        </div>
      </>
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

  function changePaymentMethod(method: AccountingLookup | undefined) {
    if (isBankTransaction({ transactionType: type, paymentMethodName }) || isBankTransaction({ transactionType: type, paymentMethodName: method?.name })) {
      setValue("autoClear", false, { shouldDirty: true });
      setValue("clearPaymentOnSave", false, { shouldDirty: true });
    }
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
  }

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

  // Bank payments keep their references with the method; cash leaves them with the notes.
  const referenceInPayment = showPaymentDetails && Boolean(paymentMethodName) && !isCashPaymentMethod(paymentMethodName);
  const referenceFields = (
    <TransactionReferenceNumberFields
      mode={isFixedCashTransactionType(type) ? "system" : refNumberMode}
      disabled={isFixedCashTransactionType(type)}
      refNumberRegister={register("refNumber")}
      error={errors.refNumber?.message}
      onModeChange={(mode: DailyIncomeRefNumberMode) => {
        setValue("refNumberMode", mode, { shouldValidate: true });
        if (mode === "system") setValue("refNumber", "", { shouldValidate: true });
      }}
    />
  );

  const assignmentSection = (
    <FormSection className={activeStep && activeStep !== "assignment" ? "hidden" : undefined} variant={activeStep ? "plain" : "card"} title={t("accounting.dailyIncome.form.sections.assignment")}>
      <TransactionAssigneeSelect
        inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
        guided={Boolean(activeStep)}
        singleColumn
        employees={employees}
        dailyRoutes={dailyRoutes}
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
        onAddEmployee={assigneeEntityActions.onAddEmployee}
        onEditEmployee={assigneeEntityActions.onEditEmployee}
        onAddRoute={assigneeEntityActions.onAddRoute}
        onEditRoute={assigneeEntityActions.onEditRoute}
        onAssigneeComplete={continueAfterAssignee}
      />
      {assigneeEntityActions.entityDialogs}
    </FormSection>
  );

  const cashAccountField = showCashAccount ? (
    <PaymentAccountSelect
      inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
      id={expensePaidByMethod ? "journal-source" : "journal-cash-account"}
      kind="cash"
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
  ) : null;

  const paymentSection = showPaymentDetails ? (
    <FormSection className={activeStep && activeStep !== "payment" ? "hidden" : undefined} variant={activeStep ? "plain" : "card"} title={t("accounting.dailyIncome.form.sections.paymentDetails")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <PaymentChannelFields
          inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
          guided={Boolean(activeStep)}
          paymentMethods={paymentMethods}
          paymentMethodId={paymentMethodId}
          paymentMethodName={paymentMethodName}
          required={needsPaymentMethod}
          error={errors.paymentMethodId?.message}
          cashField={needsBankAccount ? null : cashAccountField}
          onMethodChange={changePaymentMethod}
        />

        {needsBankAccount ? (
          <PaymentAccountSelect
            inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
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
            onChange={(account) => {
              applyMoneyAccount(setValue, moneyAccountTarget, account);
              if (isBankTransaction({ transactionType: type, paymentMethodName })) {
                setValue("autoClear", false, { shouldDirty: true });
                setValue("clearPaymentOnSave", false, { shouldDirty: true });
              }
            }}
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
        </div> : null}

        {referenceInPayment ? referenceFields : null}

        {allowAutoClear ? (
          <PaymentAutoClearField
            transactionType={type}
            amount={amount}
            paymentMethodName={paymentMethodName}
            paymentClearanceChecked={Boolean(clearPaymentOnSave)}
            onPaymentClearanceCheckedChange={(checked) => setValue("clearPaymentOnSave", checked, { shouldDirty: true })}
            checked={Boolean(autoClear)}
            onCheckedChange={(checked) => setValue("autoClear", checked, { shouldDirty: true })}
          />
        ) : null}
      </div>
    </FormSection>
  ) : null;

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
        if (savingRef.current) return;
        savingRef.current = true;
        try {
          await submitTransaction(event);
        } finally {
          savingRef.current = false;
        }
      }}
      onKeyDown={handleEnterNavigation}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden", isPhone && "bg-background")}
    >
      {showSectionNavigation ? (
        <TransactionSectionNavigation
          formRef={formRef}
          title={t(`accounting.dailyIncome.wizard.typeSelector.options.${transactionType}`)}
          onBack={onChangeType}
          backDisabled={changeTypeDisabled}
        />
      ) : null}
      <FormBody
        workflow={!isPhone && activeStep !== "review"}
        className={cn(
          activeStep && "[&_[data-form-section]>div>div>h3]:normal-case [&_[data-form-section]>div>div>h3]:tracking-normal [&_[data-form-section]>div>div>h3]:text-sm [&_[data-form-section]_label]:text-sm [&_[data-form-section]_label]:text-foreground",
          activeStep && !isPhone && "lg:p-8",
          isPhone &&
          "space-y-5 overflow-x-hidden bg-background px-4 py-5 [&_input]:h-12 [&_input]:rounded-xl [&_input]:text-base [&_label]:text-base [&_textarea]:min-h-28 [&_textarea]:rounded-xl [&_textarea]:text-base",
        )}
      >
        {activeStep ? (
          <header className="max-w-2xl space-y-2">
            <div className={cn("flex min-w-0 items-center gap-1", onStepBack && "-ml-2")}>
              {onStepBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.actions.previous")}
                  disabled={stepBackDisabled}
                  onClick={onStepBack}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}
              <h2
                data-step-heading
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none"
              >
                {t(getTransactionStepLabelKey(activeStep, type))}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(getTransactionStepHintKey(activeStep, type))}
            </p>
          </header>
        ) : null}
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
          <>
            {allowInvoiceDiscovery && (!activeStep || activeStep === "amounts") ? (
              <FormSection
                className={cn(activeStep && activeStep !== "amounts" && "hidden")}
                variant={activeStep ? "plain" : "card"}
                title={activeStep ? undefined : t("accounting.dailyIncome.form.sections.invoiceDetails")}
              >
                {invoiceSelectRow(null, true)}
                {duplicateDiscoveredInvoice ? (
                  <FormFooterNoticeMessage
                    tone="warning"
                    className="mt-3"
                    message={t("accounting.dailyIncome.form.placeholders.invoiceAlreadyExists", {
                      number: duplicateDiscoveredInvoice.invoiceNumber,
                    })}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyExistingInvoice(duplicateDiscoveredInvoice)}
                      >
                        {t("accounting.dailyIncome.form.placeholders.useExistingInvoice")}
                      </Button>
                    }
                  />
                ) : null}
              </FormSection>
            ) : null}
            <RegisterInvoiceTransactionFields
              grouped
              guided
              manualInvoiceTotals
              paymentReferenceFields={referenceInPayment ? referenceFields : null}
              quickEntry={quickEntry}
              activeStep={activeStep}
              employees={employees}
              dailyRoutes={dailyRoutes}
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
              onAddEmployee={assigneeEntityActions.onAddEmployee}
              onEditEmployee={assigneeEntityActions.onEditEmployee}
              onAddRoute={assigneeEntityActions.onAddRoute}
              onEditRoute={assigneeEntityActions.onEditRoute}
              onAssigneeComplete={continueAfterAssignee}
            />
            {assigneeEntityActions.entityDialogs}
          </>
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
            {assignmentSection}
            {activeStep ? null : paymentSection}
            {showExistingInvoiceDetails ? (
              <FormSection className={cn("[&_label]:min-h-0 [&_label]:text-xs [&_label]:font-medium [&_label]:leading-4 [&_label]:text-muted-foreground", !activeStep && "p-4", activeStep && activeStep !== "amounts" && "hidden")} variant={activeStep ? "plain" : "card"} title={activeStep ? undefined : t("accounting.dailyIncome.form.sections.invoiceDetails")}>
                <div className="@container">
                  <div className="flex min-w-0 flex-col gap-3">
                    {invoiceSelectRow(null, true)}
                    {selectedInvoice ? (
                    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                      <dl className="grid min-w-0 grid-cols-2 gap-4 px-4 py-3">
                        {invoiceTextRow("journal-invoice-sender", t("accounting.dailyIncome.form.fields.senderClient"), selectedInvoice?.sender?.name)}
                        {invoiceTextRow("journal-invoice-receiver", t("accounting.dailyIncome.form.fields.receiverClient"), selectedInvoice ? getInvoicePrimaryReceiver(selectedInvoice)?.name : null)}
                      </dl>
                      <dl className="grid min-w-0 grid-cols-2 gap-4 border-y border-border bg-muted/35 px-4 py-3 tabular-nums sm:grid-cols-4">
                        {invoiceTextRow("journal-invoice-total", t("accounting.dailyIncome.form.sections.invoiceAmount"), selectedInvoice ? formatAccountingMoney(getInvoiceTotal(selectedInvoice)) : null)}
                        {invoiceSummaryRow("journal-invoice-discount", t("accounting.dailyIncome.form.invoiceSummary.discount"), selectedInvoice?.discount ?? null)}
                        {invoiceSummaryRow("journal-invoice-paid", t("accounting.dailyIncome.form.invoiceSummary.paid"), selectedInvoice?.amountPaid ?? null)}
                        {invoiceSummaryRow(
                          "journal-invoice-current-balance",
                          t("accounting.dailyIncome.form.invoiceSummary.balance"),
                          selectedInvoice ? getInvoiceBalanceAmount(selectedInvoice) : null,
                          true,
                        )}
                      </dl>
                      {selectedInvoicePaidOff ? null : isInvoiceAdjustment
                        ? renderInvoiceAdjustmentAmountField(type, true)
                        : renderInvoiceAmountRow("accounting.dailyIncome.form.fields.paymentAmount", { error: errors.amount?.message })}
                    </div>
                    ) : null}
                  </div>
                </div>
              </FormSection>
            ) : (
            <FormSection className={activeStep && activeStep !== "amounts" ? "hidden" : undefined} variant="card" title={t(needsExistingInvoice ? "accounting.dailyIncome.form.sections.invoiceDetails" : isTransfer ? "accounting.dailyIncome.form.sections.transferDetails" : "accounting.dailyIncome.form.sections.amounts")}>
              {isTransfer ? (
                <div className="grid gap-4">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-3">
                    <div className="min-w-0 space-y-2">
                      <RequiredLabel htmlFor="journal-source">{t("accounting.dailyIncome.form.fields.transferFrom")}</RequiredLabel>
                      <SearchableSelect
                        inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                        id="journal-source"
                        value={sourceAccountId != null ? String(sourceAccountId) : ""}
                        onValueChange={(next) => {
                          const account = transferAccounts.find((item) => item.id === Number(next));
                          setValue("sourceAccountId", account?.id, { shouldValidate: true });
                          setValue("sourceAccountName", account?.displayName ?? "");
                          setValue("sourceAccountType", account?.type);
                        }}
                        placeholder={t("accounting.dailyIncome.form.placeholders.selectTransferFrom")}
                        searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchAccounts")}
                        selectAllOnFocus
                        mobileSheet
                        options={transferOptions(accountId, sourceAccountId, sourceAccountName)}
                        aria-invalid={Boolean(errors.sourceAccountId)}
                      />
                      <FieldMessage error={errors.sourceAccountId?.message} hint={t("accounting.dailyIncome.form.hints.transferFrom")} />
                    </div>
                    <span aria-hidden="true" className="flex justify-center text-muted-foreground sm:mt-8">
                      <ArrowDown className="size-4 sm:hidden" />
                      <ArrowRight className="hidden size-4 sm:block" />
                    </span>
                    <div className="min-w-0 space-y-2">
                      <RequiredLabel htmlFor="journal-account">{t("accounting.dailyIncome.form.fields.transferTo")}</RequiredLabel>
                      <SearchableSelect
                        inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                        id="journal-account"
                        value={accountId != null ? String(accountId) : ""}
                        onValueChange={(next) => {
                          const account = transferAccounts.find((item) => item.id === Number(next));
                          setValue("accountId", account?.id, { shouldValidate: true });
                          setValue("accountName", account?.displayName ?? "");
                          setValue("accountType", account?.type);
                        }}
                        placeholder={t("accounting.dailyIncome.form.placeholders.selectTransferTo")}
                        searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchAccounts")}
                        selectAllOnFocus
                        mobileSheet
                        options={transferOptions(sourceAccountId, accountId, accountName)}
                        aria-invalid={Boolean(errors.accountId)}
                      />
                      <FieldMessage error={errors.accountId?.message} hint={t("accounting.dailyIncome.form.hints.transferTo")} />
                    </div>
                  </div>
                  {amountField}
                </div>
              ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {needsExistingInvoice ? (
                  <div className="min-w-0 sm:col-span-2">
                    {invoiceSelectRow(invoiceDetailsCard(false, true))}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:col-span-2">
                  {needsAccount ? (
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="journal-account">{t("accounting.dailyIncome.form.fields.account")}</RequiredLabel>
                      <SearchableSelect
                        inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
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
                        inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
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
                      <FieldMessage
                        error={errors.sourceAccountId?.message}
                        hint={type === "EXPENSE" ? t("accounting.dailyIncome.form.hints.expenseSourceAccount") : t("accounting.dailyIncome.form.hints.sourceAccount")}
                      />
                    </div>
                  ) : null}

                  {amountField}
                </div>

              </div>
              )}
            </FormSection>
            )}
            {activeStep ? paymentSection : null}
          </div>
        )}
        <FormSection
          className={activeStep && activeStep !== (showPaymentDetails ? "payment" : "amounts") ? "hidden" : undefined}
          variant="card"
          title={t(referenceInPayment ? "accounting.dailyIncome.form.sections.notes" : "accounting.dailyIncome.form.sections.referenceAndNotes")}
        >
          <div className="space-y-4">
            {referenceInPayment ? null : referenceFields}
            {descriptionField}
          </div>
        </FormSection>
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
