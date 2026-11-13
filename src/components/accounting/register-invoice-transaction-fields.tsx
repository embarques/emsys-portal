"use client";

import { useEffect, useMemo, useState } from "react";
import { ReceiptText, UserRound } from "lucide-react";
import type { UseFormSetValue, UseFormTrigger, UseFormWatch, FieldErrors } from "react-hook-form";

import { FieldMessage } from "@/components/forms/field-message";
import { FormSection } from "@/components/forms/form-shell";
import { getInvoiceBalanceInputClassName, getInvoiceBalanceTextClassName } from "@/components/accounting/invoice-balance-tone";
import { PaymentAutoClearField } from "@/components/accounting/payment-auto-clear-field";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { PaymentAccountSelect } from "@/components/accounting/payment-account-select";
import { PaymentChannelFields } from "@/components/accounting/payment-channel-fields";
import { Button } from "@/components/ui/button";
import { applyMoneyAccount, findDefaultCashAccount, isCashAccountSelectable, listCashAccounts, listSelectableBankAccounts, resolveDefaultBankAccount } from "@/lib/accounting/daily-income/payment-accounts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { selectFormFieldTextOnFocus, submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceNumberModeFields } from "@/components/invoices/invoice-number-switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCustomerPicker, useCustomerSearch } from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import type { Customer } from "@/lib/customers/types";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";
import { findCashPaymentMethod, isCashPaymentMethod, isCheckPaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import type { TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import {
  formatMoneyFormDisplayValue,
  formatMoneyFormEditValue,
  moneyFormSetValueAs,
} from "@/lib/accounting/daily-income/money-input";
import type { Employee } from "@/lib/employees/types";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

function computeInvoiceBalance(cost: unknown, discount: unknown, amount: unknown) {
  const parsedCost = typeof cost === "number" ? cost : Number(cost);
  const parsedDiscount = typeof discount === "number" ? discount : Number(discount ?? 0);
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(parsedCost) || !Number.isFinite(parsedAmount)) return null;
  return Math.round((parsedCost - (Number.isFinite(parsedDiscount) ? parsedDiscount : 0) - parsedAmount) * 100) / 100;
}

const EMPTY_ACCOUNTS: ChartAccount[] = [];

type InvoiceAmountField = "invoiceCost" | "invoiceDiscount" | "amount";

/** Discount is validated against Total, and Paid against Total minus Discount. */
const INVOICE_AMOUNT_DEPENDENTS: Record<InvoiceAmountField, InvoiceAmountField[]> = {
  invoiceCost: ["invoiceDiscount", "amount"],
  invoiceDiscount: ["amount"],
  amount: [],
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

function customerOptionDescription(customer: Customer) {
  const phone = getPrimaryPhoneDisplayNumber(customer.phones);
  const address1 = getCustomerPrimaryCoreAddress(customer).address1.trim();
  return [phone, address1].filter(Boolean);
}

function customerOptions(customers: Customer[]) {
  return customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    descriptionLines: customerOptionDescription(customer),
    keywords: [customer.name, ...customerOptionDescription(customer)],
  }));
}

type Props = {
  quickEntry?: boolean;
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  statementBranchId?: number | null;
  /** Full chart of accounts; enables choosing a cash account for cash payments. */
  accounts?: ChartAccount[];
  bankAccounts: ChartAccount[];
  paymentMethods: AccountingLookup[];
  errors: FieldErrors<DailyIncomeJournalValues>;
  register: ReturnType<typeof import("react-hook-form").useForm<DailyIncomeJournalValues>>["register"];
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  watch: UseFormWatch<DailyIncomeJournalValues>;
  /** Revalidates dependent amount fields so cross-field errors refresh as amounts change. */
  trigger?: UseFormTrigger<DailyIncomeJournalValues>;
  /** Hide employee assignee (still required in form values when hidden). */
  showEmployee?: boolean;
  /** Group Daily Income entry into desktop workflow sections. */
  grouped?: boolean;
  activeStep?: TransactionFormStep;
  /** Let the assignee be an employee or a daily route. */
  allowDailyRoute?: boolean;
  /** Hide invoice number (still required in form values when hidden). */
  showInvoiceNumber?: boolean;
  /** Hide sender / receiver party pickers. */
  showParties?: boolean;
  /** When true, cost is shown but not editable (driven by invoice line items). */
  invoiceCostReadOnly?: boolean;
  /** Offer the auto-clear switch (Daily Income create only). */
  allowAutoClear?: boolean;
  /** Grouped layout: show Payment & references before Invoice details. */
  paymentSectionFirst?: boolean;
  /** Enter Total, Discount, and Paid by hand; Balance subtracts the discount. */
  manualInvoiceTotals?: boolean;
  /** Show the description field in Payment & references. */
  showDescription?: boolean;
  /** Grouped layout: tighter cards with payment method and account fields on one row. */
  compact?: boolean;
  /** Grouped layout in workflow order: cash or bank, invoice, then who handled it. */
  guided?: boolean;
  /** Guided layout: reference fields shown with the payment (bank payments). */
  paymentReferenceFields?: React.ReactNode;
  onAssigneeComplete?: () => void;
};

export function RegisterInvoiceTransactionFields({
  employees,
  dailyRoutes,
  statementDate,
  statementBranchId,
  accounts = EMPTY_ACCOUNTS,
  bankAccounts,
  paymentMethods,
  errors,
  register,
  setValue,
  watch,
  trigger,
  grouped = false,
  quickEntry = false,
  activeStep,
  showEmployee = true,
  allowDailyRoute = false,
  showInvoiceNumber = true,
  showParties = true,
  invoiceCostReadOnly = false,
  allowAutoClear = false,
  paymentSectionFirst = false,
  manualInvoiceTotals = false,
  showDescription = false,
  compact = false,
  guided = false,
  paymentReferenceFields,
  onAssigneeComplete,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canUseManualNumber = hasPermission(
    PERMISSIONS.invoicesManualNumber.name,
    PERMISSIONS.invoicesManualNumber.resourceType,
  );
  const automaticNumber = watch("autoGenerateInvoiceNumber") ?? true;
  useEffect(() => {
    // Hidden numbering is managed by the invoice wizard that owns these fields.
    if (showInvoiceNumber && !canUseManualNumber && !automaticNumber) {
      setValue("autoGenerateInvoiceNumber", true, { shouldValidate: true });
    }
  }, [automaticNumber, canUseManualNumber, setValue, showInvoiceNumber]);

  const employeeId = watch("employeeId");
  const employeeName = watch("employeeName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const supervisorId = watch("supervisorId");
  const supervisorName = watch("supervisorName");
  const assigneeSource = watch("assigneeSource");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const paymentAccountId = watch("paymentAccountId");
  const paymentAccountName = watch("paymentAccountName");
  const paymentAccountType = watch("paymentAccountType");
  const cashAccounts = useMemo(() => listCashAccounts(accounts), [accounts]);
  const selectableBankAccounts = useMemo(() => listSelectableBankAccounts(bankAccounts), [bankAccounts]);
  const showCashAccount = cashAccounts.length > 0 && isCashAccountSelectable("INITIAL-PAYMENT", isCashPaymentMethod(paymentMethodName));
  const invoiceCost = watch("invoiceCost");
  const invoiceDiscount = watch("invoiceDiscount");
  const amount = watch("amount");
  const autoClear = watch("autoClear");
  const clearPaymentOnSave = watch("clearPaymentOnSave");
  const [costDraft, setCostDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  function setInvoiceAmountValue(name: InvoiceAmountField, value: number | undefined) {
    setValue(name, value, { shouldValidate: !trigger, shouldDirty: true });
    if (trigger) void trigger([name, ...INVOICE_AMOUNT_DEPENDENTS[name]]);
  }
  const paymentDetailsRequired = (Number(amount) || 0) > 0;
  const balance = computeInvoiceBalance(invoiceCost, manualInvoiceTotals ? invoiceDiscount : 0, amount);
  const stackedAmounts = grouped && manualInvoiceTotals;
  const inlineInvoiceParties = stackedAmounts && !activeStep;
  const amountRowClassName = stackedAmounts ? "row-span-3 grid min-w-0 grid-rows-subgrid gap-y-1" : "space-y-2 min-w-0";
  const amountMessageClassName = stackedAmounts ? "row-start-3" : undefined;
  const includeSender = watch("includeSender");
  const includeReceiver = watch("includeReceiver");
  const senderId = watch("senderId");
  const senderName = watch("senderName");
  const receiverId = watch("receiverId");
  const receiverName = watch("receiverName");

  useEffect(() => {
    if (amount == null) setValue("amount", 0);
  }, [amount, setValue]);

  useEffect(() => {
    if (paymentMethods.length === 0) return;
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
  }, [paymentMethodId, paymentMethodName, paymentMethods, setValue]);

  // Clear the bank or cash account when the payment method no longer uses it.
  useEffect(() => {
    if (!paymentAccountId) return;
    const stillValid = needsBankAccount
      ? paymentAccountType !== "ASSET"
      : showCashAccount && paymentAccountType === "ASSET";
    if (stillValid) return;
    setValue("paymentAccountId", undefined, { shouldValidate: false });
    setValue("paymentAccountName", undefined, { shouldValidate: false });
    setValue("paymentAccountType", undefined, { shouldValidate: false });
  }, [needsBankAccount, paymentAccountId, paymentAccountType, setValue, showCashAccount]);

  useEffect(() => {
    if (paymentAccountId) return;
    const account = needsBankAccount
      ? resolveDefaultBankAccount(bankAccounts)
      : showCashAccount
        ? findDefaultCashAccount(cashAccounts)
        : undefined;
    if (account) applyMoneyAccount(setValue, "paymentAccount", account);
  }, [bankAccounts, cashAccounts, needsBankAccount, paymentAccountId, setValue, showCashAccount]);

  const [senderQuery, setSenderQuery] = useState("");
  const [receiverQuery, setReceiverQuery] = useState("");
  const debouncedSenderQuery = useDebouncedValue(senderQuery, 300).trim();
  const debouncedReceiverQuery = useDebouncedValue(receiverQuery, 300).trim();

  const customersQuery = useCustomerPicker(200);
  const customers = useMemo(() => customersQuery.data?.items ?? [], [customersQuery.data?.items]);

  const senderCustomers = useMemo(
    () => customers.filter((customer) => customer.active && isCustomerSenderType(customer.customerType)),
    [customers],
  );
  const receiverCustomers = useMemo(
    () => customers.filter((customer) => customer.active && isCustomerReceiverType(customer.customerType)),
    [customers],
  );

  const senderSearch = useCustomerSearch(
    debouncedSenderQuery ? { value: debouncedSenderQuery } : undefined,
    { customerType: CUSTOMER_TYPE_SENDER, orFields: CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS, limit: 40 },
  );
  const receiverSearch = useCustomerSearch(
    debouncedReceiverQuery ? { value: debouncedReceiverQuery } : undefined,
    { customerType: CUSTOMER_TYPE_RECEIVER, orFields: CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS, limit: 40 },
  );

  const senderOptions = useMemo(() => {
    const source = debouncedSenderQuery
      ? (senderSearch.data?.items ?? []).filter(
        (customer) => customer.active && isCustomerSenderType(customer.customerType),
      )
      : senderCustomers;
    const options = customerOptions(source);
    if (senderId && !source.some((customer) => customer.id === senderId)) {
      const pinned = customers.find((customer) => customer.id === senderId);
      if (pinned) options.unshift(...customerOptions([pinned]));
    }
    return withPinnedSelectOption(options, senderId, senderName);
  }, [customers, debouncedSenderQuery, senderCustomers, senderId, senderName, senderSearch.data?.items]);

  const paymentMethodOptions = useMemo(
    () =>
      withPinnedSelectOption(
        [
          { value: "", label: t("accounting.dailyIncome.form.placeholders.selectPaymentMethod") },
          ...paymentMethods.map((method) => ({
            value: String(method.id),
            label: method.name,
            keywords: [method.name],
          })),
        ],
        paymentMethodId,
        paymentMethodName,
      ),
    [paymentMethodId, paymentMethodName, paymentMethods, t],
  );
  const receiverOptions = useMemo(() => {
    const source = debouncedReceiverQuery
      ? (receiverSearch.data?.items ?? []).filter(
        (customer) => customer.active && isCustomerReceiverType(customer.customerType),
      )
      : receiverCustomers;
    const options = customerOptions(source);
    if (receiverId && !source.some((customer) => customer.id === receiverId)) {
      const pinned = customers.find((customer) => customer.id === receiverId);
      if (pinned) options.unshift(...customerOptions([pinned]));
    }
    return withPinnedSelectOption(options, receiverId, receiverName);
  }, [customers, debouncedReceiverQuery, receiverCustomers, receiverId, receiverName, receiverSearch.data?.items]);

  function updateSender(nextId: string) {
    const customer =
      senderCustomers.find((entry) => entry.id === nextId) ??
      senderSearch.data?.items.find((entry) => entry.id === nextId) ??
      customers.find((entry) => entry.id === nextId);
    setValue("senderId", nextId || undefined, { shouldValidate: true });
    setValue("senderName", customer?.name ?? "", { shouldValidate: true });
  }

  function updateReceiver(nextId: string) {
    const customer =
      receiverCustomers.find((entry) => entry.id === nextId) ??
      receiverSearch.data?.items.find((entry) => entry.id === nextId) ??
      customers.find((entry) => entry.id === nextId);
    setValue("receiverId", nextId || undefined, { shouldValidate: true });
    setValue("receiverName", customer?.name ?? "", { shouldValidate: true });
  }

  function setPartyIncluded(side: "sender" | "receiver", include: boolean) {
    if (side === "sender") {
      setValue("includeSender", include, { shouldValidate: true });
      if (include) return;
      setValue("senderId", undefined, { shouldValidate: true });
      setValue("senderName", "");
      setSenderQuery("");
      return;
    }
    setValue("includeReceiver", include, { shouldValidate: true });
    if (include) return;
    setValue("receiverId", undefined, { shouldValidate: true });
    setValue("receiverName", "");
    setReceiverQuery("");
  }

  function partyModeField(side: "sender" | "receiver", included: boolean, field: React.ReactNode) {
    const id = `journal-${side}-mode`;
    return (
      <div className={cn("min-w-0 space-y-2", inlineInvoiceParties && side === "receiver" && "border-l border-border pl-4")}>
        <div className="space-y-2">
          <div className={cn(inlineInvoiceParties && "flex min-w-0 items-center gap-2")}>
            {inlineInvoiceParties ? (
              <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", side === "sender" ? "bg-primary/10 text-primary" : "border border-border bg-muted/40 text-muted-foreground")}>
                <UserRound className="size-3.5" />
              </span>
            ) : null}
            <Label id={`${id}-label`}>
              {t(side === "sender" ? "accounting.dailyIncome.form.fields.senderClient" : "accounting.dailyIncome.form.fields.receiverClient")}
            </Label>
          </div>
          <div data-enter-navigation="field">
            <SegmentedControl<"skip" | "include">
              id={id}
              aria-labelledby={`${id}-label`}
              value={included ? "include" : "skip"}
              className={inlineInvoiceParties ? "[&>button]:px-1 [&>button]:text-xs" : undefined}
              onValueChange={(next) => setPartyIncluded(side, next === "include")}
              options={[
                { value: "skip", label: t("accounting.dailyIncome.form.fields.partyModeSkip") },
                { value: "include", label: t("accounting.dailyIncome.form.fields.partyModeInclude") },
              ]}
            />
          </div>
        </div>
        {included ? field : null}
      </div>
    );
  }

  const assigneeFields = (
    <>
      {showEmployee ? (
        <div className="sm:col-span-2">
          <TransactionAssigneeSelect
            inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
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
            allowDailyRoute={allowDailyRoute}
            error={errors.employeeId?.message ?? errors.routeId?.message}
            supervisorError={errors.supervisorId?.message}
            setValue={setValue}
            onAssigneeComplete={onAssigneeComplete}
          />
        </div>
      ) : null}
    </>
  );

  function changePaymentMethod(method: AccountingLookup | undefined) {
    setValue("autoClear", false, { shouldDirty: true });
    setValue("clearPaymentOnSave", false, { shouldDirty: true });
    setValue("paymentMethodId", method?.id, { shouldValidate: true, shouldDirty: true });
    setValue("paymentMethodName", method?.name ?? "", { shouldValidate: true, shouldDirty: true });
    if (!requiresBankAccount(method?.name)) {
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

  const cashAccountField = showCashAccount ? (
    <PaymentAccountSelect
      inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
      id="journal-cash-account"
      kind="cash"
      accounts={cashAccounts}
      pathSource={accounts}
      value={paymentAccountId}
      valueName={paymentAccountName}
      hint={t("accounting.dailyIncome.form.hints.cashAccount")}
      onChange={(account) => applyMoneyAccount(setValue, "paymentAccount", account)}
    />
  ) : null;

  const channelFields = (
    <PaymentChannelFields
      inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
      paymentMethods={paymentMethods}
      paymentMethodId={paymentMethodId}
      paymentMethodName={paymentMethodName}
      required={paymentDetailsRequired}
      error={errors.paymentMethodId?.message}
      cashField={needsBankAccount ? null : cashAccountField}
      onMethodChange={changePaymentMethod}
    />
  );

  const methodFields = (
    <>
      <div className={cn("space-y-2 min-w-0", !compact && "sm:col-span-2")}>
        {paymentDetailsRequired ? (
          <RequiredLabel htmlFor="journal-payment">
            {t("accounting.dailyIncome.form.fields.paymentMethod")}
          </RequiredLabel>
        ) : (
          <Label htmlFor="journal-payment">{t("accounting.dailyIncome.form.fields.paymentMethod")}</Label>
        )}
        <SearchableSelect
          inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
          id="journal-payment"
          value={paymentMethodId != null ? String(paymentMethodId) : ""}
          onValueChange={(next) => changePaymentMethod(paymentMethods.find((item) => item.id === Number(next)))}
          placeholder={t("accounting.dailyIncome.form.placeholders.selectPaymentMethod")}
          searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchPaymentMethods")}
          mobileSheet
          options={paymentMethodOptions}
          aria-invalid={Boolean(errors.paymentMethodId)}
        />
        <FieldMessage error={errors.paymentMethodId?.message} />
      </div>
    </>
  );

  const bankFields = (
    <>
      {needsBankAccount ? (
        <PaymentAccountSelect
          inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
          id="journal-bank-account"
          kind="bank"
          accounts={selectableBankAccounts}
          pathSource={bankAccounts}
          value={paymentAccountId}
          valueName={paymentAccountName}
          required={paymentDetailsRequired}
          error={errors.paymentAccountId?.message}
          onChange={(account) => {
            applyMoneyAccount(setValue, "paymentAccount", account);
            setValue("autoClear", false, { shouldDirty: true });
            setValue("clearPaymentOnSave", false, { shouldDirty: true });
          }}
        />
      ) : guided ? null : cashAccountField}
    </>
  );

  const checkFields = (
    <>
      {isCheck ? (
        <div className="space-y-2 min-w-0">
          {paymentDetailsRequired ? (
            <RequiredLabel htmlFor="journal-check-number">
              {t("accounting.dailyIncome.form.fields.checkNumber")}
            </RequiredLabel>
          ) : (
            <Label htmlFor="journal-check-number">{t("accounting.dailyIncome.form.fields.checkNumber")}</Label>
          )}
          <Input
            id="journal-check-number"
            placeholder={t("accounting.dailyIncome.form.placeholders.enterCheckNumber")}
            autoComplete="off"
            aria-invalid={Boolean(errors.checkNumber)}
            {...register("checkNumber")}
          />
          <FieldMessage
            error={errors.checkNumber?.message}
            hint={t("accounting.dailyIncome.form.fields.checkNumberHint")}
          />
        </div>
      ) : null}
    </>
  );

  const invoiceFields = (
    <>
      {showInvoiceNumber ? (
        <div className={grouped ? "min-w-0" : "min-w-0 sm:col-span-2"}>
          <InvoiceNumberModeFields
            id="journal-invoice-number"
            variant="segmented"
            compact
            showModeLabel
            modeLabelIcon={<ReceiptText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            autoGenerate={automaticNumber}
            invoiceNumber={watch("invoiceNumber") ?? ""}
            canUseManualNumber={canUseManualNumber}
            onModeChange={(nextAutoGenerate) => {
              setValue("autoGenerateInvoiceNumber", nextAutoGenerate, { shouldValidate: true, shouldDirty: true });
              if (nextAutoGenerate) {
                setValue("invoiceNumber", "", { shouldValidate: true, shouldDirty: true });
              }
            }}
            onInvoiceNumberChange={(next) => {
              setValue("invoiceNumber", next, { shouldValidate: true, shouldDirty: true });
            }}
          />
          <FieldMessage error={errors.invoiceNumber?.message} className="mt-2" />
        </div>
      ) : null}
    </>
  );

  const externalReferenceFields = isCheck || isCashPaymentMethod(paymentMethodName) ? null : (
    <>
      <div className="space-y-2 min-w-0">
        <Label htmlFor="journal-external-reference">{t("accounting.dailyIncome.form.fields.externalReferenceNumber")}</Label>
        <Input
          id="journal-external-reference"
          autoComplete="off"
          placeholder={t("accounting.dailyIncome.form.placeholders.externalReferenceNumber")}
          {...register("externalReferenceNumber")}
        />
      </div>
    </>
  );

  const autoClearFields = allowAutoClear ? (
    <PaymentAutoClearField
      transactionType="INITIAL-PAYMENT"
      amount={amount}
      paymentMethodName={paymentMethodName}
      paymentClearanceChecked={Boolean(clearPaymentOnSave)}
      onPaymentClearanceCheckedChange={(checked) => setValue("clearPaymentOnSave", checked, { shouldDirty: true })}
      checked={Boolean(autoClear)}
      onCheckedChange={(checked) => setValue("autoClear", checked, { shouldDirty: true })}
    />
  ) : null;

  const costFields = (
    <>
      <div className={amountRowClassName}>
        <RequiredLabel htmlFor="journal-invoice-cost">
          {t(manualInvoiceTotals ? "accounting.dailyIncome.form.invoiceSummary.total" : "accounting.dailyIncome.form.fields.cost")}
        </RequiredLabel>
        {invoiceCostReadOnly ? (
          <Input
            id="journal-invoice-cost"
            readOnly
            tabIndex={-1}
            value={formatMoneyFormDisplayValue(invoiceCost)}
            className={cn("bg-muted/40 tabular-nums", stackedAmounts && "text-right")}
            aria-invalid={Boolean(errors.invoiceCost)}
          />
        ) : (
          <Input
            id="journal-invoice-cost"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
            className={cn("tabular-nums", stackedAmounts && "text-right")}
            value={costDraft ?? formatMoneyFormDisplayValue(invoiceCost)}
            onFocus={(event) => {
              setCostDraft(formatMoneyFormEditValue(invoiceCost));
              selectFormFieldTextOnFocus(event);
            }}
            onChange={(event) => {
              const next = event.target.value;
              setCostDraft(next);
              setInvoiceAmountValue("invoiceCost", moneyFormSetValueAs(next));
            }}
            onBlur={() => setCostDraft(null)}
            onKeyDown={grouped ? undefined : submitFormOnEnterKeyDown}
            aria-invalid={Boolean(errors.invoiceCost)}
          />
        )}
        <FieldMessage
          className={amountMessageClassName}
          error={
            errors.invoiceCost
              ? invoiceCostReadOnly
                ? t("accounting.dailyIncome.form.validation.costFromLineItemsRequired")
                : errors.invoiceCost.message
              : null
          }
          hint={invoiceCostReadOnly ? t("accounting.dailyIncome.form.hints.costFromLineItems") : null}
        />
      </div>
    </>
  );

  const discountFields = manualInvoiceTotals ? (
    <div className={amountRowClassName}>
      <Label htmlFor="journal-invoice-discount">{t("accounting.dailyIncome.form.invoiceSummary.discount")}</Label>
      <Input
        id="journal-invoice-discount"
        inputMode="decimal"
        autoComplete="off"
        placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
        className={cn("tabular-nums", stackedAmounts && "text-right")}
        value={discountDraft ?? formatMoneyFormDisplayValue(invoiceDiscount ?? 0)}
        onFocus={(event) => {
          setDiscountDraft(formatMoneyFormEditValue(invoiceDiscount ?? 0));
          selectFormFieldTextOnFocus(event);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDiscountDraft(next);
          setInvoiceAmountValue("invoiceDiscount", moneyFormSetValueAs(next) ?? 0);
        }}
        onBlur={() => setDiscountDraft(null)}
        aria-invalid={Boolean(errors.invoiceDiscount)}
      />
      <FieldMessage className={amountMessageClassName} error={errors.invoiceDiscount?.message} />
    </div>
  ) : null;

  const descriptionFields = showDescription ? (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor="journal-description">{t("accounting.dailyIncome.form.fields.description")}</Label>
      <textarea
        id="journal-description"
        rows={3}
        placeholder={t("accounting.dailyIncome.form.placeholders.enterDescription")}
        className="flex h-auto w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        {...register("description")}
      />
      <FieldMessage error={errors.description?.message} />
    </div>
  ) : null;

  const amountFields = (
    <>
      <div className={amountRowClassName}>
        <Label htmlFor="journal-amount">
          {t(manualInvoiceTotals ? "accounting.dailyIncome.form.invoiceSummary.paid" : "accounting.dailyIncome.form.fields.amount")}
        </Label>
        <Input
          id="journal-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
          className={cn("tabular-nums", stackedAmounts && "text-right")}
          value={amountDraft ?? formatMoneyFormDisplayValue(amount)}
          onFocus={(event) => {
            setAmountDraft(formatMoneyFormEditValue(amount));
            selectFormFieldTextOnFocus(event);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setAmountDraft(next);
            const parsed = moneyFormSetValueAs(next);
            setInvoiceAmountValue("amount", parsed == null ? 0 : parsed);
          }}
          onBlur={() => setAmountDraft(null)}
          onKeyDown={quickEntry ? (event) => {
              if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.form?.requestSubmit();
            } : grouped ? undefined : submitFormOnEnterKeyDown}
          aria-invalid={Boolean(errors.amount)}
        />
        <FieldMessage className={amountMessageClassName} error={errors.amount?.message} />
      </div>
    </>
  );

  const hasInvoiceTotal = (Number(invoiceCost) || 0) > 0;
  const balanceFields = hasInvoiceTotal ? (
    <>
      <div className={stackedAmounts ? "min-w-0 space-y-1" : amountRowClassName}>
        <Label htmlFor="journal-invoice-balance">{t("accounting.dailyIncome.form.fields.balance")}</Label>
        <Input
          id="journal-invoice-balance"
          readOnly
          tabIndex={-1}
          value={balance == null ? "" : formatMoneyFormDisplayValue(balance)}
          className={cn("tabular-nums", stackedAmounts ? cn("border-0 bg-transparent p-0 text-left text-2xl font-semibold shadow-none max-md:text-2xl md:text-2xl", getInvoiceBalanceTextClassName(balance)) : getInvoiceBalanceInputClassName(balance))}
          aria-invalid={balance != null && balance < 0}
        />
        <FieldMessage
          className={stackedAmounts ? undefined : amountMessageClassName}
          error={balance != null && balance < 0 ? t("accounting.dailyIncome.form.validation.balanceNegative") : null}
        />
      </div>
    </>
  ) : null;

  const partiesFields = (
    <>
      {showParties ? (
        <div className={inlineInvoiceParties ? "grid min-w-0 grid-cols-2 gap-4 px-4 py-3" : "space-y-4 min-w-0 sm:col-span-2"}>
          {partyModeField("sender", Boolean(includeSender), (
            <>
              <SearchableSelect
                inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                id="journal-sender"
                aria-label={t("accounting.dailyIncome.form.fields.senderClient")}
                value={senderId ?? ""}
                onValueChange={updateSender}
                placeholder={t("accounting.dailyIncome.form.placeholders.searchSender")}
                searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchSenders")}
                manualFiltering
                mobileSheet
                loading={senderSearch.isFetching}
                onSearchChange={setSenderQuery}
                options={[{ value: "", label: t("accounting.dailyIncome.form.placeholders.selectSender") }, ...senderOptions]}
              />
              <FieldMessage error={errors.senderId?.message} />
            </>
          ))}
          {partyModeField("receiver", Boolean(includeReceiver), (
            <>
              <SearchableSelect
                inlineOptionsLimit={activeStep ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                id="journal-receiver"
                aria-label={t("accounting.dailyIncome.form.fields.receiverClient")}
                value={receiverId ?? ""}
                onValueChange={updateReceiver}
                placeholder={t("accounting.dailyIncome.form.placeholders.searchReceiver")}
                searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchReceivers")}
                manualFiltering
                mobileSheet
                loading={receiverSearch.isFetching}
                onSearchChange={setReceiverQuery}
                options={[{ value: "", label: t("accounting.dailyIncome.form.placeholders.selectReceiver") }, ...receiverOptions]}
              />
              <FieldMessage error={errors.receiverId?.message} />
            </>
          ))}
        </div>
      ) : null}
    </>
  );

  if (grouped) {
    const assignmentStepClassName = activeStep && activeStep !== "assignment" ? "hidden" : undefined;
    const amountsStepClassName = activeStep && activeStep !== "amounts" ? "hidden" : undefined;
    const invoiceDetailsSection = manualInvoiceTotals ? (
      <FormSection className={cn("p-4 [&_label]:min-h-0 [&_label]:text-xs [&_label]:font-medium [&_label]:leading-4 [&_label]:text-muted-foreground", amountsStepClassName)} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceDetails")}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {showInvoiceNumber ? <div className="border-b border-border bg-muted/25 px-4 py-3">{invoiceFields}</div> : null}
            {inlineInvoiceParties ? partiesFields : null}
            <div className="flex items-center gap-3 border-t border-border bg-muted/50 px-4 py-2.5">
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ReceiptText className="size-5" />
              </span>
              <h4 className="text-xs font-medium text-muted-foreground">{t("accounting.dailyIncome.form.sections.invoiceAmount")}</h4>
            </div>
            <div className="grid min-w-0 grid-cols-3 gap-x-3 gap-y-1 bg-muted/35 px-4 py-3 sm:gap-x-6">
              {costFields}
              {discountFields}
              {amountFields}
            </div>
            {balanceFields ? <div className="border-t border-border px-4 py-3">{balanceFields}</div> : null}
            {activeStep === "amounts" ? <div className="flex flex-wrap gap-2 border-t px-4 py-3">
              <Button type="button" size="sm" variant="outline" onClick={() => { setAmountDraft(null); setInvoiceAmountValue("amount", 0); }}>
                {t("accounting.dailyIncome.wizard.quickFlow.noPayment")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!invoiceCost || invoiceCost - (invoiceDiscount ?? 0) <= 0} onClick={() => { setAmountDraft(null); setInvoiceAmountValue("amount", Math.max(0, (invoiceCost ?? 0) - (invoiceDiscount ?? 0))); }}>
                {t("accounting.dailyIncome.wizard.quickFlow.paidInFull")}
              </Button>
            </div> : null}
          </div>
        </div>
      </FormSection>
    ) : (
      <FormSection className={amountsStepClassName} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceDetails")}>
        {showInvoiceNumber ? <div className="mb-4">{invoiceFields}</div> : null}
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          {costFields}
          {amountFields}
          {balanceFields}
        </div>
      </FormSection>
    );
    const partiesSection = showParties && !quickEntry && !inlineInvoiceParties ? (
      <FormSection
        className={activeStep && activeStep !== "parties" ? "hidden" : undefined}
        variant="card"
        title={t("accounting.dailyIncome.form.sections.customers")}
      >
        {partiesFields}
      </FormSection>
    ) : null;

    const assignmentSection = showEmployee ? (
      <FormSection className={assignmentStepClassName} variant="card" title={t("accounting.dailyIncome.form.sections.assignment")}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {assigneeFields}
        </div>
      </FormSection>
    ) : null;
    const paymentFirst = guided || paymentSectionFirst;

    return (
      <div className="space-y-5">
        {guided ? null : assignmentSection}
        {paymentFirst ? null : invoiceDetailsSection}
        <FormSection className={!quickEntry && activeStep && activeStep !== "payment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.paymentDetails")}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {guided ? channelFields : (
              <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
                {methodFields}
              </div>
            )}
            <div className="grid min-w-0 gap-4 empty:hidden sm:col-span-2 sm:grid-cols-2">
              {bankFields}
              {checkFields}
              {!quickEntry && externalReferenceFields}
            </div>
            {guided && !quickEntry ? paymentReferenceFields : null}
            {!quickEntry && autoClearFields}
            {!quickEntry && descriptionFields}
          </div>
        </FormSection>
        {paymentFirst ? invoiceDetailsSection : null}
        {partiesSection}
        {guided ? assignmentSection : null}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {assigneeFields}
      <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
        {methodFields}
      </div>
      <div className="grid min-w-0 gap-4 empty:hidden sm:col-span-2 sm:grid-cols-2">
        {bankFields}
        {checkFields}
        {externalReferenceFields}
      </div>
      {autoClearFields}
      {invoiceFields}
      <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-3">
        {costFields}
        {amountFields}
        {balanceFields}
      </div>
      {partiesFields}
    </div>
  );
}
