"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import type { AccountingLookup, ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";

const selectClassName = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";
const TRANSACTION_TYPES: { value: JournalTransactionType; label: string }[] = [
  { value: "INITIAL-PAYMENT", label: "Register invoice" },
  { value: "PAYMENT", label: "Register payment" },
  { value: "EXPENSE", label: "Register expense" },
  { value: "SALES", label: "Register income" },
  { value: "DISCOUNT", label: "Apply discount" },
  { value: "SURCHARGE", label: "Apply surcharge" },
  { value: "ACCOUNT-TRANSFER", label: "Transfer account" },
  { value: "LOAN", label: "Register loan" },
];

type Props = {
  initialValues: DailyIncomeJournalValues;
  employees: Employee[];
  accounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: DailyIncomeJournalValues) => void;
  onCancel: () => void;
};

export function DailyIncomeTransactionForm({ initialValues, employees, accounts, invoices, paymentMethods, isSubmitting, error, onSubmit, onCancel }: Props) {
  const { formState: { errors }, handleSubmit, register, reset, setValue, watch } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(dailyIncomeJournalSchema), defaultValues: initialValues,
  });
  useEffect(() => reset(initialValues), [initialValues, reset]);
  const type = watch("transactionType");
  const needsInvoice = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type);
  const needsAccount = ["EXPENSE", "SALES", "ACCOUNT-TRANSFER", "LOAN"].includes(type);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="journal-type">Transaction</Label>
          <select id="journal-type" className={selectClassName} {...register("transactionType")}>{TRANSACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="journal-employee">Employee</Label>
          <select id="journal-employee" className={selectClassName} onChange={(event) => {
            const employee = employees.find((item) => String(item.id) === event.target.value);
            setValue("employeeId", employee?.id);
            setValue("employeeName", employee?.name ?? "");
          }} defaultValue={initialValues.employeeId ?? ""}>
            <option value="">Select employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
          {errors.employeeId ? <p className="text-sm text-destructive">{errors.employeeId.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="journal-amount">Amount</Label>
          <Input id="journal-amount" type="number" min="0.01" step="0.01" {...register("amount", { valueAsNumber: true })} />
          {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
        </div>
        {needsInvoice ? <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="journal-invoice">Invoice</Label>
          <select id="journal-invoice" className={selectClassName} onChange={(event) => {
            const invoice = invoices.find((item) => item.invoiceId === event.target.value);
            setValue("invoiceId", invoice?.invoiceId ?? ""); setValue("invoiceNumber", invoice?.invoiceNumber ?? "");
          }} defaultValue={initialValues.invoiceId ?? ""}>
            <option value="">Select invoice</option>
            {invoices.map((invoice) => <option key={invoice.invoiceId} value={invoice.invoiceId}>{invoice.invoiceNumber}</option>)}
          </select>
          {errors.invoiceId ? <p className="text-sm text-destructive">{errors.invoiceId.message}</p> : null}
        </div> : null}
        {needsAccount ? <div className="space-y-2">
          <Label htmlFor="journal-account">Account</Label>
          <select id="journal-account" className={selectClassName} onChange={(event) => {
            const account = accounts.find((item) => item.id === Number(event.target.value));
            setValue("accountId", account?.id); setValue("accountName", account?.displayName ?? "");
          }} defaultValue={initialValues.accountId ?? ""}>
            <option value="">Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}
          </select>
          {errors.accountId ? <p className="text-sm text-destructive">{errors.accountId.message}</p> : null}
        </div> : null}
        {type === "ACCOUNT-TRANSFER" || type === "EXPENSE" || type === "LOAN" ? <div className="space-y-2">
          <Label htmlFor="journal-source">Source account</Label>
          <select id="journal-source" className={selectClassName} onChange={(event) => {
            const account = accounts.find((item) => item.id === Number(event.target.value));
            setValue("sourceAccountId", account?.id); setValue("sourceAccountName", account?.displayName ?? "");
          }} defaultValue={initialValues.sourceAccountId ?? ""}>
            <option value="">Select source account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}
          </select>
          {errors.sourceAccountId ? <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p> : null}
        </div> : null}
        <div className="space-y-2">
          <Label htmlFor="journal-payment">Payment method</Label>
          <select id="journal-payment" className={selectClassName} onChange={(event) => {
            const method = paymentMethods.find((item) => item.id === Number(event.target.value));
            setValue("paymentMethodId", method?.id); setValue("paymentMethodName", method?.name ?? "");
          }} defaultValue={initialValues.paymentMethodId ?? ""}>
            <option value="">Select payment method</option>
            {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
          {errors.paymentMethodId ? <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p> : null}
        </div>
        <div className="space-y-2"><Label htmlFor="journal-reference">Reference number</Label><Input id="journal-reference" {...register("refNumber")} /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="journal-description">Description</Label><textarea id="journal-description" rows={3} className={`${selectClassName} h-auto py-2`} {...register("description")} /></div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save transaction"}</Button></div>
    </form>
  );
}
