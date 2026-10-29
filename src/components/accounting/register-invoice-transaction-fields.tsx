"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form";

import { FieldMessage } from "@/components/forms/field-message";
import { FormSection } from "@/components/forms/form-shell";
import { PaymentAutoClearField } from "@/components/accounting/payment-auto-clear-field";
import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { TransactionReferenceNumberFields } from "@/components/accounting/transaction-reference-number-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { selectFormFieldTextOnFocus, submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceNumberModeFields } from "@/components/invoices/invoice-number-switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCustomerPicker, useCustomerSearch } from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import type { Customer } from "@/lib/customers/types";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";
import { findCashPaymentMethod, isCashPaymentMethod, isCheckPaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type DailyIncomeRefNumberMode } from "@/lib/accounting/daily-income/types";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import {
  formatMoneyFormDisplayValue,
  formatMoneyFormEditValue,
  moneyFormSetValueAs,
} from "@/lib/accounting/daily-income/money-input";
import type { Employee } from "@/lib/employees/types";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

function computeInvoiceBalance(cost: unknown, discount: unknown, amount: unknown) {
  const parsedCost = typeof cost === "number" ? cost : Number(cost);
  const parsedDiscount = typeof discount === "number" ? discount : Number(discount ?? 0);
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(parsedCost) || !Number.isFinite(parsedAmount)) return null;
  return Math.round((parsedCost - (Number.isFinite(parsedDiscount) ? parsedDiscount : 0) - parsedAmount) * 100) / 100;
}

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
  bankAccounts: ChartAccount[];
  paymentMethods: AccountingLookup[];
  errors: FieldErrors<DailyIncomeJournalValues>;
  register: ReturnType<typeof import("react-hook-form").useForm<DailyIncomeJournalValues>>["register"];
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  watch: UseFormWatch<DailyIncomeJournalValues>;
  /** Hide employee assignee (still required in form values when hidden). */
  showEmployee?: boolean;
  /** Group Daily Income entry into desktop workflow sections. */
  grouped?: boolean;
  activeStep?: "assignment" | "amounts" | "payment" | "review";
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
  /** Rendered first in Invoice details (existing vs new invoice choice). */
  invoiceModeField?: ReactNode;
};

export function RegisterInvoiceTransactionFields({
  employees,
  dailyRoutes,
  statementDate,
  statementBranchId,
  bankAccounts,
  paymentMethods,
  errors,
  register,
  setValue,
  watch,
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
  invoiceModeField,
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
  const refNumberMode = watch("refNumberMode");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const paymentAccountId = watch("paymentAccountId");
  const paymentAccountName = watch("paymentAccountName");
  const invoiceCost = watch("invoiceCost");
  const invoiceDiscount = watch("invoiceDiscount");
  const amount = watch("amount");
  const autoClear = watch("autoClear");
  const [costDraft, setCostDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const paymentDetailsRequired = (Number(amount) || 0) > 0;
  const balance = computeInvoiceBalance(invoiceCost, manualInvoiceTotals ? invoiceDiscount : 0, amount);
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

  // Clear bank account when the payment method no longer needs one.
  useEffect(() => {
    if (needsBankAccount || !paymentAccountId) return;
    setValue("paymentAccountId", undefined, { shouldValidate: false });
    setValue("paymentAccountName", undefined, { shouldValidate: false });
    setValue("paymentAccountType", undefined, { shouldValidate: false });
  }, [needsBankAccount, paymentAccountId, setValue]);

  const [senderQuery, setSenderQuery] = useState("");
  const [receiverQuery, setReceiverQuery] = useState("");
  const debouncedSenderQuery = useDebouncedValue(senderQuery, 300).trim();
  const debouncedReceiverQuery = useDebouncedValue(receiverQuery, 300).trim();

  const customersQuery = useCustomerPicker(200);
  const customers = customersQuery.data?.items ?? [];

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

  const assigneeFields = (
    <>
      {showEmployee ? (
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
            allowDailyRoute={allowDailyRoute}
            error={errors.employeeId?.message ?? errors.routeId?.message}
            supervisorError={errors.supervisorId?.message}
            setValue={setValue}
          />
        </div>
      ) : null}
    </>
  );

  const methodFields = (
    <>
      <div className="space-y-2 min-w-0 sm:col-span-2">
        {paymentDetailsRequired ? (
          <RequiredLabel htmlFor="journal-payment">
            {t("accounting.dailyIncome.form.fields.paymentMethod")}
          </RequiredLabel>
        ) : (
          <Label htmlFor="journal-payment">{t("accounting.dailyIncome.form.fields.paymentMethod")}</Label>
        )}
        <SearchableSelect
          id="journal-payment"
          value={paymentMethodId != null ? String(paymentMethodId) : ""}
          onValueChange={(next) => {
            const method = paymentMethods.find((item) => item.id === Number(next));
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
          }}
          placeholder={t("accounting.dailyIncome.form.placeholders.selectPaymentMethod")}
          searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchPaymentMethods")}
          mobileSheet
          options={paymentMethodOptions}
          aria-invalid={Boolean(errors.paymentMethodId)}
        />
        <FieldMessage
          error={errors.paymentMethodId?.message}
          hint={
            !paymentDetailsRequired && paymentMethodName?.trim() && !isCashPaymentMethod(paymentMethodName)
              ? t("accounting.dailyIncome.form.hints.paymentMethodOptionalZero")
              : null
          }
        />
      </div>
    </>
  );

  const bankFields = (
    <>
      {needsBankAccount ? (
        <div className="space-y-2 min-w-0">
          {paymentDetailsRequired ? (
            <RequiredLabel htmlFor="journal-bank-account">
              {t("accounting.dailyIncome.form.fields.bankAccount")}
            </RequiredLabel>
          ) : (
            <Label htmlFor="journal-bank-account">{t("accounting.dailyIncome.form.fields.bankAccount")}</Label>
          )}
          <SearchableSelect
            id="journal-bank-account"
            value={paymentAccountId != null ? String(paymentAccountId) : ""}
            onValueChange={(next) => {
              if (!next) {
                setValue("paymentAccountId", undefined, { shouldValidate: true, shouldDirty: true });
                setValue("paymentAccountName", undefined, { shouldValidate: true, shouldDirty: true });
                setValue("paymentAccountType", undefined, { shouldValidate: true, shouldDirty: true });
                return;
              }
              const account = bankAccounts.find((item) => item.id === Number(next));
              setValue("paymentAccountId", account?.id, { shouldValidate: true, shouldDirty: true });
              setValue("paymentAccountName", account?.displayName ?? "", { shouldValidate: true, shouldDirty: true });
              setValue("paymentAccountType", account?.type ?? "BANK", { shouldValidate: true, shouldDirty: true });
            }}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectBankAccount")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchBankAccounts")}
            mobileSheet
            options={bankAccountOptions}
            aria-invalid={Boolean(errors.paymentAccountId)}
          />
          <FieldMessage error={errors.paymentAccountId?.message} />
        </div>
      ) : null}
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
        <FieldMessage hint={t("accounting.dailyIncome.form.fields.externalReferenceHint")} />
      </div>
    </>
  );

  const autoClearFields = allowAutoClear ? (
    <PaymentAutoClearField
      transactionType="INITIAL-PAYMENT"
      amount={amount}
      paymentMethodName={paymentMethodName}
      checked={Boolean(autoClear)}
      onCheckedChange={(checked) => setValue("autoClear", checked, { shouldDirty: true })}
    />
  ) : null;

  const referenceFields = (
    <>
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
    </>
  );

  const costFields = (
    <>
      <div className="space-y-2 min-w-0">
        <RequiredLabel htmlFor="journal-invoice-cost">
          {t(manualInvoiceTotals ? "accounting.dailyIncome.form.invoiceSummary.total" : "accounting.dailyIncome.form.fields.cost")}
        </RequiredLabel>
        {invoiceCostReadOnly ? (
          <Input
            id="journal-invoice-cost"
            readOnly
            tabIndex={-1}
            value={formatMoneyFormDisplayValue(invoiceCost)}
            className="bg-muted/40 tabular-nums"
            aria-invalid={Boolean(errors.invoiceCost)}
          />
        ) : (
          <Input
            id="journal-invoice-cost"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
            className="tabular-nums"
            value={costDraft ?? formatMoneyFormDisplayValue(invoiceCost)}
            onFocus={(event) => {
              setCostDraft(formatMoneyFormEditValue(invoiceCost));
              selectFormFieldTextOnFocus(event);
            }}
            onChange={(event) => {
              const next = event.target.value;
              setCostDraft(next);
              setValue("invoiceCost", moneyFormSetValueAs(next), { shouldValidate: true, shouldDirty: true });
            }}
            onBlur={() => setCostDraft(null)}
            onKeyDown={grouped ? undefined : submitFormOnEnterKeyDown}
            aria-invalid={Boolean(errors.invoiceCost)}
          />
        )}
        <FieldMessage
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
    <div className="space-y-2 min-w-0">
      <Label htmlFor="journal-invoice-discount">{t("accounting.dailyIncome.form.invoiceSummary.discount")}</Label>
      <Input
        id="journal-invoice-discount"
        inputMode="decimal"
        autoComplete="off"
        placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
        className="tabular-nums"
        value={discountDraft ?? formatMoneyFormDisplayValue(invoiceDiscount ?? 0)}
        onFocus={(event) => {
          setDiscountDraft(formatMoneyFormEditValue(invoiceDiscount ?? 0));
          selectFormFieldTextOnFocus(event);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDiscountDraft(next);
          setValue("invoiceDiscount", moneyFormSetValueAs(next) ?? 0, { shouldValidate: true, shouldDirty: true });
        }}
        onBlur={() => setDiscountDraft(null)}
        aria-invalid={Boolean(errors.invoiceDiscount)}
      />
      <FieldMessage error={errors.invoiceDiscount?.message} />
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
      <div className="space-y-2 min-w-0">
        <Label htmlFor="journal-amount">
          {t(manualInvoiceTotals ? "accounting.dailyIncome.form.invoiceSummary.paid" : "accounting.dailyIncome.form.fields.amount")}
        </Label>
        <Input
          id="journal-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
          className="tabular-nums"
          value={amountDraft ?? formatMoneyFormDisplayValue(amount)}
          onFocus={(event) => {
            setAmountDraft(formatMoneyFormEditValue(amount));
            selectFormFieldTextOnFocus(event);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setAmountDraft(next);
            const parsed = moneyFormSetValueAs(next);
            setValue("amount", parsed == null ? 0 : parsed, { shouldValidate: true, shouldDirty: true });
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
        <FieldMessage
          error={errors.amount?.message}
          hint={t("accounting.dailyIncome.form.hints.amountZeroAllowed")}
        />
      </div>
    </>
  );

  const balanceFields = (
    <>
      <div className="space-y-2 min-w-0">
        <Label htmlFor="journal-invoice-balance">{t("accounting.dailyIncome.form.fields.balance")}</Label>
        <Input
          id="journal-invoice-balance"
          readOnly
          tabIndex={-1}
          value={balance == null ? "" : formatMoneyFormDisplayValue(balance)}
          className="bg-muted/40 tabular-nums"
          aria-invalid={balance != null && balance < 0}
        />
        <FieldMessage
          error={balance != null && balance < 0 ? t("accounting.dailyIncome.form.validation.balanceNegative") : null}
        />
      </div>
    </>
  );

  const partiesFields = (
    <>
      {showParties ? (
        <div className="space-y-3 min-w-0 sm:col-span-2">
          <div className="grid min-w-0 grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                id="journal-skip-sender"
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={!includeSender}
                onChange={(event) => {
                  const skip = event.target.checked;
                  setValue("includeSender", !skip, { shouldValidate: true });
                  if (skip) {
                    setValue("senderId", undefined, { shouldValidate: true });
                    setValue("senderName", "");
                    setSenderQuery("");
                  }
                }}
              />
              {t("accounting.dailyIncome.form.fields.skipSender")}
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                id="journal-skip-receiver"
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={!includeReceiver}
                onChange={(event) => {
                  const skip = event.target.checked;
                  setValue("includeReceiver", !skip, { shouldValidate: true });
                  if (skip) {
                    setValue("receiverId", undefined, { shouldValidate: true });
                    setValue("receiverName", "");
                    setReceiverQuery("");
                  }
                }}
              />
              {t("accounting.dailyIncome.form.fields.skipReceiver")}
            </label>
          </div>
          {includeSender || includeReceiver ? (
            <div className={grouped ? "grid min-w-0 gap-4 sm:grid-cols-2" : "space-y-3"}>
              {includeSender ? (
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="journal-sender">{t("accounting.dailyIncome.form.fields.senderClient")}</Label>
                  <SearchableSelect
                    id="journal-sender"
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
                </div>
              ) : null}
              {includeReceiver ? (
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="journal-receiver">{t("accounting.dailyIncome.form.fields.receiverClient")}</Label>
                  <SearchableSelect
                    id="journal-receiver"
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
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (grouped) {
    const amountsStepClassName = activeStep && activeStep !== "amounts" ? "hidden" : undefined;
    const invoiceDetailsSection = manualInvoiceTotals ? (
      <>
        <FormSection className={amountsStepClassName} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceDetails")}>
          <div className="space-y-4">
            {invoiceModeField}
            {invoiceFields}
            {quickEntry ? null : partiesFields}
          </div>
        </FormSection>
        <FormSection className={amountsStepClassName} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceAmount")}>
          <div className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
            {costFields}
            {discountFields}
            {amountFields}
            {balanceFields}
          </div>
        </FormSection>
      </>
    ) : (
      <FormSection className={amountsStepClassName} variant="card" title={t("accounting.dailyIncome.form.sections.invoiceDetails")}>
        {showInvoiceNumber ? <div className="mb-4">{invoiceFields}</div> : null}
        {showParties && !quickEntry ? <div className="mb-4">{partiesFields}</div> : null}
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          {costFields}
          {amountFields}
          {balanceFields}
        </div>
      </FormSection>
    );

    return (
      <div className="space-y-5">
        {showEmployee ? (
          <FormSection className={activeStep && activeStep !== "assignment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.assignment")}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {assigneeFields}
            </div>
          </FormSection>
        ) : null}
        {paymentSectionFirst ? null : invoiceDetailsSection}
        <FormSection className={!quickEntry && activeStep && activeStep !== "payment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.paymentDetails")}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
              {methodFields}
            </div>
            <div className="grid min-w-0 gap-4 empty:hidden sm:col-span-2 sm:grid-cols-2">
              {bankFields}
              {checkFields}
              {!quickEntry && externalReferenceFields}
            </div>
            {!quickEntry && autoClearFields}
            {!quickEntry && referenceFields}
            {!quickEntry && descriptionFields}
          </div>
        </FormSection>
        {paymentSectionFirst ? invoiceDetailsSection : null}
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
      {referenceFields}
      <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-3">
        {costFields}
        {amountFields}
        {balanceFields}
      </div>
      {partiesFields}
    </div>
  );
}
