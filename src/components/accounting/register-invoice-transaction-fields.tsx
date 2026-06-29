"use client";

import { useMemo, useState } from "react";
import type { UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCustomerPicker, useCustomerSearch } from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import type { Customer } from "@/lib/customers/types";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";
import type { AccountingLookup, DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

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
  const address1 = customer.address.address1.trim();
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
  paymentMethods: AccountingLookup[];
  errors: FieldErrors<DailyIncomeJournalValues>;
  register: ReturnType<typeof import("react-hook-form").useForm<DailyIncomeJournalValues>>["register"];
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  watch: UseFormWatch<DailyIncomeJournalValues>;
};

export function RegisterInvoiceTransactionFields({
  employees,
  paymentMethods,
  errors,
  register,
  setValue,
  watch,
}: Props) {
  const employeeId = watch("employeeId");
  const paymentMethodId = watch("paymentMethodId");
  const invoiceCost = watch("invoiceCost");
  const amount = watch("amount");
  const balance = computeInvoiceBalance(invoiceCost, amount);
  const includeSender = watch("includeSender");
  const includeReceiver = watch("includeReceiver");
  const senderId = watch("senderId");
  const receiverId = watch("receiverId");

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
    return options;
  }, [customers, debouncedSenderQuery, senderCustomers, senderId, senderSearch.data?.items]);

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
    return options;
  }, [customers, debouncedReceiverQuery, receiverCustomers, receiverId, receiverSearch.data?.items]);

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
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-employee">Employee</RequiredLabel>
        <select
          id="journal-employee"
          className={selectClassName}
          value={employeeId ?? ""}
          onChange={(event) => {
            const employee = employees.find((item) => String(item.id) === event.target.value);
            setValue("employeeId", employee?.id, { shouldValidate: true });
            setValue("employeeName", employee?.name ?? "");
          }}
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        {errors.employeeId ? <p className="text-sm text-destructive">{errors.employeeId.message}</p> : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-invoice-number">Invoice</RequiredLabel>
        <Input
          id="journal-invoice-number"
          placeholder="Enter new invoice number"
          {...register("invoiceNumber")}
        />
        {errors.invoiceNumber ? (
          <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-invoice-cost">Cost</RequiredLabel>
        <Input
          id="journal-invoice-cost"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          {...register("invoiceCost", { valueAsNumber: true })}
        />
        {errors.invoiceCost ? <p className="text-sm text-destructive">{errors.invoiceCost.message}</p> : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-amount">Amount</RequiredLabel>
        <Input
          id="journal-amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          {...register("amount", { valueAsNumber: true })}
        />
        {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="journal-invoice-balance">Balance</Label>
        <Input
          id="journal-invoice-balance"
          readOnly
          tabIndex={-1}
          value={balance == null ? "" : formatMoney(balance)}
          className="bg-muted/40"
          aria-invalid={balance != null && balance < 0}
        />
        {balance != null && balance < 0 ? (
          <p className="text-sm text-destructive">Balance cannot be negative.</p>
        ) : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="journal-payment">Payment method</RequiredLabel>
        <select
          id="journal-payment"
          className={selectClassName}
          value={paymentMethodId ?? ""}
          onChange={(event) => {
            const method = paymentMethods.find((item) => item.id === Number(event.target.value));
            setValue("paymentMethodId", method?.id, { shouldValidate: true });
            setValue("paymentMethodName", method?.name ?? "");
          }}
        >
          <option value="">Select payment method</option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
        {errors.paymentMethodId ? (
          <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
        ) : null}
      </div>

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
          Include sender client
        </label>
        {includeSender ? (
          <div className="space-y-2">
            <Label htmlFor="journal-sender">Sender client</Label>
            <SearchableSelect
              id="journal-sender"
              value={senderId ?? ""}
              onValueChange={updateSender}
              placeholder="Search sender by name, phone, or address…"
              searchPlaceholder="Search senders…"
              manualFiltering
              loading={senderSearch.isFetching}
              onSearchChange={setSenderQuery}
              options={[{ value: "", label: "Select sender" }, ...senderOptions]}
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
          Include receiver client
        </label>
        {includeReceiver ? (
          <div className="space-y-2">
            <Label htmlFor="journal-receiver">Receiver client</Label>
            <SearchableSelect
              id="journal-receiver"
              value={receiverId ?? ""}
              onValueChange={updateReceiver}
              placeholder="Search receiver by name, phone, or address…"
              searchPlaceholder="Search receivers…"
              manualFiltering
              loading={receiverSearch.isFetching}
              onSearchChange={setReceiverQuery}
              options={[{ value: "", label: "Select receiver" }, ...receiverOptions]}
            />
            {errors.receiverId ? <p className="text-sm text-destructive">{errors.receiverId.message}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
