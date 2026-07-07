"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
import {
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/hooks";
import {
  isZellePaymentMethod,
  requiresBankAccount,
  type DailyIncomeJournal,
  type DailyIncomeStatement,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  invoiceDailyIncomeRegistrationSchema,
  type InvoiceDailyIncomeRegistrationValues,
} from "@/lib/invoices/schemas/invoice-daily-income.schema";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

type Props = {
  open: boolean;
  statement: DailyIncomeStatement;
  invoice: InvoiceFormValues;
  onOpenChange: (open: boolean) => void;
  onRegistered: (journal: DailyIncomeJournal) => void | Promise<void>;
};

const DEFAULT_VALUES: InvoiceDailyIncomeRegistrationValues = {
  amount: 0,
  refNumber: "",
  description: "Initial invoice registration",
};

export function InvoiceDailyIncomeDialog({
  open,
  statement,
  invoice,
  onOpenChange,
  onRegistered,
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUser();
  const paymentMethodsQuery = useAccountingPaymentMethods(open);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, open);
  const createJournal = useCreateDailyIncomeJournal();
  const invoiceSubtotal = useMemo(
    () => invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [invoice.lineItems],
  );
  const invoiceTotal = Math.max(0, invoiceSubtotal - (Number(invoice.discount) || 0));

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<InvoiceDailyIncomeRegistrationValues>({
    resolver: zodResolver(invoiceDailyIncomeRegistrationSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(DEFAULT_VALUES);
    setSubmitError(null);
  }, [open, reset]);

  const amount = watch("amount") ?? 0;
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const paymentAccountId = watch("paymentAccountId");
  const paymentRequired = amount > 0;
  const needsBankAccount = paymentRequired && requiresBankAccount(paymentMethodName);
  const isZelle = paymentRequired && isZellePaymentMethod(paymentMethodName);
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];

  async function submit(values: InvoiceDailyIncomeRegistrationValues) {
    const currentUser = currentUserQuery.data;
    if (!currentUser) {
      setSubmitError("Current employee information is not available.");
      return;
    }

    try {
      setSubmitError(null);
      const journal = await createJournal.mutateAsync({
        statement,
        values: {
          transactionType: "INITIAL-PAYMENT",
          amount: values.amount,
          refNumber: values.refNumber,
          description: values.description,
          employeeId: currentUser.id,
          employeeName: currentUser.name,
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
        },
      });

      if (!journal) throw new Error("The API did not return the Daily Income registration.");
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
          <DialogTitle>Register daily income</DialogTitle>
          <DialogDescription>
            Register this invoice in the open Daily Income before continuing.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <p>
              Invoice <span className="font-semibold">{invoice.invoiceNumber}</span>
            </p>
            <p>
              Daily income #{statement.id} · <span className="font-medium text-emerald-700">Open</span>
            </p>
            <p className="text-muted-foreground">
              {statement.date} · {statement.branch?.name || statement.branch?.code || "Current branch"}
            </p>
          </div>

          {submitError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily-income-invoice-total">Invoice total</Label>
              <Input id="daily-income-invoice-total" value={formatInvoiceMoney(invoiceTotal)} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-income-payment-amount">Payment amount</Label>
              <Input
                id="daily-income-payment-amount"
                type="number"
                min={0}
                max={invoiceTotal}
                step="0.01"
                inputMode="decimal"
                {...register("amount", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Payment is optional. Zero creates an unpaid invoice.
              </p>
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-semibold">Payment details</p>
              <p className="text-xs text-muted-foreground">
                Required only when payment amount is greater than $0.00.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="daily-income-payment-method">Payment method</Label>
                <SearchableSelect
                  id="daily-income-payment-method"
                  disabled={!paymentRequired}
                  value={paymentMethodId ? String(paymentMethodId) : ""}
                  onValueChange={(next) => {
                    const method = paymentMethods.find((item) => item.id === Number(next));
                    setValue("paymentMethodId", method?.id, { shouldValidate: true });
                    setValue("paymentMethodName", method?.name ?? "", { shouldValidate: true });
                    if (!requiresBankAccount(method?.name)) {
                      setValue("paymentAccountId", undefined, { shouldValidate: true });
                    }
                  }}
                  placeholder="Select payment method"
                  searchPlaceholder="Search payment methods…"
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
                <Label htmlFor="daily-income-payment-account">Payment account</Label>
                <SearchableSelect
                  id="daily-income-payment-account"
                  disabled={!needsBankAccount}
                  value={paymentAccountId ? String(paymentAccountId) : ""}
                  onValueChange={(next) => {
                    const account = bankAccounts.find((item) => item.id === Number(next));
                    setValue("paymentAccountId", account?.id, { shouldValidate: true });
                    setValue("paymentAccountName", account?.displayName ?? "");
                    setValue("paymentAccountType", account?.type);
                  }}
                  placeholder="Select bank account"
                  searchPlaceholder="Search bank accounts…"
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
                <Label htmlFor="daily-income-reference">Reference number</Label>
                <Input id="daily-income-reference" disabled={!paymentRequired} {...register("refNumber")} />
                {errors.refNumber ? <p className="text-xs text-destructive">{errors.refNumber.message}</p> : null}
              </div>

              {isZelle ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="daily-income-zelle-date">Zelle transaction date</Label>
                    <Input id="daily-income-zelle-date" type="date" {...register("zelleTransactionDate")} />
                    {errors.zelleTransactionDate ? (
                      <p className="text-xs text-destructive">{errors.zelleTransactionDate.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily-income-zelle-name">Zelle transaction name</Label>
                    <Input id="daily-income-zelle-name" {...register("zelleTransactionName")} />
                    {errors.zelleTransactionName ? (
                      <p className="text-xs text-destructive">{errors.zelleTransactionName.message}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Input value={currentUserQuery.data?.name ?? "Loading employee…"} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-income-description">Description</Label>
              <Input id="daily-income-description" {...register("description")} />
              {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createJournal.isPending || currentUserQuery.isLoading}>
              {createJournal.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {createJournal.isPending ? "Registering…" : "Register & continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
