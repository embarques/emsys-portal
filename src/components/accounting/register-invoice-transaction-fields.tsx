"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form";

import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCustomerPicker, useCustomerSearch } from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import type { Customer } from "@/lib/customers/types";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";
import { findCashPaymentMethod, isCheckPaymentMethod, isZellePaymentMethod, matchPaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import type { Employee } from "@/lib/employees/types";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function computeInvoiceBalance(cost: unknown, amount: unknown) {
  const parsedCost = typeof cost === "number" ? cost : Number(cost);
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(parsedCost) || !Number.isFinite(parsedAmount)) return null;
  return parsedCost - parsedAmount;
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
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  bankAccounts: ChartAccount[];
  paymentMethods: AccountingLookup[];
  errors: FieldErrors<DailyIncomeJournalValues>;
  register: ReturnType<typeof import("react-hook-form").useForm<DailyIncomeJournalValues>>["register"];
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  watch: UseFormWatch<DailyIncomeJournalValues>;
  /** Hide employee assignee (still required in form values when hidden). */
  showEmployee?: boolean;
  /** Let the assignee be an employee or a daily route. */
  allowDailyRoute?: boolean;
  /** Hide invoice number (still required in form values when hidden). */
  showInvoiceNumber?: boolean;
  /** Hide sender / receiver party pickers. */
  showParties?: boolean;
  /** When true, cost is shown but not editable (driven by invoice line items). */
  invoiceCostReadOnly?: boolean;
};

export function RegisterInvoiceTransactionFields({
  employees,
  dailyRoutes,
  statementDate,
  bankAccounts,
  paymentMethods,
  errors,
  register,
  setValue,
  watch,
  showEmployee = true,
  allowDailyRoute = false,
  showInvoiceNumber = true,
  showParties = true,
  invoiceCostReadOnly = false,
}: Props) {
  const { t } = useTranslation();
  const employeeId = watch("employeeId");
  const employeeName = watch("employeeName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const assigneeSource = watch("assigneeSource");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const isZelle = isZellePaymentMethod(paymentMethodName);
  const isCheck = isCheckPaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const paymentAccountId = watch("paymentAccountId");
  const paymentAccountName = watch("paymentAccountName");
  const invoiceCost = watch("invoiceCost");
  const amount = watch("amount");
  const paymentDetailsRequired = (Number(amount) || 0) > 0;
  const balance = computeInvoiceBalance(invoiceCost, amount);
  const includeSender = watch("includeSender");
  const includeReceiver = watch("includeReceiver");
  const senderId = watch("senderId");
  const senderName = watch("senderName");
  const receiverId = watch("receiverId");
  const receiverName = watch("receiverName");

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

  useEffect(() => {
    if (!paymentDetailsRequired || !needsBankAccount || paymentAccountId || !bankAccounts[0]) {
      return;
    }
    const account = bankAccounts[0];
    setValue("paymentAccountId", account.id, { shouldValidate: true });
    setValue("paymentAccountName", account.displayName);
    setValue("paymentAccountType", account.type);
  }, [bankAccounts, needsBankAccount, paymentAccountId, paymentDetailsRequired, setValue]);

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

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {showEmployee ? (
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
            allowDailyRoute={allowDailyRoute}
            error={errors.employeeId?.message ?? errors.routeId?.message}
            setValue={setValue}
          />
        </div>
      ) : null}

      <div className="space-y-2 sm:col-span-2">
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
        {!paymentDetailsRequired ? (
          <p className="text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.hints.paymentMethodOptionalZero")}
          </p>
        ) : null}
        {errors.paymentMethodId ? (
          <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
        ) : null}
      </div>

      {paymentDetailsRequired && needsBankAccount ? (
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

      {paymentDetailsRequired && isZelle ? (
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

      {paymentDetailsRequired && isCheck ? (
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

      {showInvoiceNumber ? (
        <div className="space-y-2 sm:col-span-2">
          <RequiredLabel htmlFor="journal-invoice-number">{t("accounting.dailyIncome.form.fields.invoice")}</RequiredLabel>
          <Input
            id="journal-invoice-number"
            placeholder={t("accounting.dailyIncome.form.placeholders.enterInvoiceNumber")}
            {...register("invoiceNumber")}
          />
          {errors.invoiceNumber ? (
            <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="journal-invoice-cost">{t("accounting.dailyIncome.form.fields.cost")}</RequiredLabel>
        <Input
          id="journal-invoice-cost"
          type="number"
          min="0.01"
          step="0.01"
          placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
          readOnly={invoiceCostReadOnly}
          disabled={invoiceCostReadOnly}
          {...register("invoiceCost", { setValueAs: moneyFormSetValueAs })}
        />
        {invoiceCostReadOnly ? (
          <p className="text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.hints.costFromLineItems")}
          </p>
        ) : null}
        {errors.invoiceCost ? <p className="text-sm text-destructive">{errors.invoiceCost.message}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="journal-amount">{t("accounting.dailyIncome.form.fields.amount")}</Label>
        <Input
          id="journal-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder={t("accounting.dailyIncome.form.placeholders.amount")}
          {...register("amount", {
            setValueAs: (value) => {
              const parsed = moneyFormSetValueAs(value);
              return parsed == null ? 0 : parsed;
            },
          })}
          onKeyDown={submitFormOnEnterKeyDown}
        />
        <p className="text-xs text-muted-foreground">
          {t("accounting.dailyIncome.form.hints.amountZeroAllowed")}
        </p>
        {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="journal-reference">{t("accounting.dailyIncome.form.fields.referenceNumber")}</Label>
        <Input
          id="journal-reference"
          placeholder={t("accounting.dailyIncome.form.placeholders.enterReferenceNumber")}
          {...register("refNumber")}
          onKeyDown={submitFormOnEnterKeyDown}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="journal-invoice-balance">{t("accounting.dailyIncome.form.fields.balance")}</Label>
        <Input
          id="journal-invoice-balance"
          readOnly
          tabIndex={-1}
          value={balance == null ? "" : formatMoney(balance)}
          className="bg-muted/40"
          aria-invalid={balance != null && balance < 0}
        />
        {balance != null && balance < 0 ? (
          <p className="text-sm text-destructive">{t("accounting.dailyIncome.form.validation.balanceNegative")}</p>
        ) : null}
      </div>

      {showParties ? (
        <>
          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                id="journal-include-sender"
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={Boolean(includeSender)}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setValue("includeSender", enabled, { shouldValidate: true });
                  if (!enabled) {
                    setValue("senderId", undefined, { shouldValidate: true });
                    setValue("senderName", "");
                    setSenderQuery("");
                  }
                }}
              />
              {t("accounting.dailyIncome.form.fields.includeSender")}
            </label>
            {includeSender ? (
              <div className="space-y-2">
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
                {errors.senderId ? <p className="text-sm text-destructive">{errors.senderId.message}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                id="journal-include-receiver"
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={Boolean(includeReceiver)}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setValue("includeReceiver", enabled, { shouldValidate: true });
                  if (!enabled) {
                    setValue("receiverId", undefined, { shouldValidate: true });
                    setValue("receiverName", "");
                    setReceiverQuery("");
                  }
                }}
              />
              {t("accounting.dailyIncome.form.fields.includeReceiver")}
            </label>
            {includeReceiver ? (
              <div className="space-y-2">
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
                {errors.receiverId ? <p className="text-sm text-destructive">{errors.receiverId.message}</p> : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
