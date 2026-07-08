"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
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
  useCreateIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import { dailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import {
  isZellePaymentMethod,
  requiresBankAccount,
  type DailyIncomeJournal,
  type DailyIncomeStatement,
  type DailyIncomeStatementValues,
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
  description: "Initial invoice registration",
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [activeStatement, setActiveStatement] = useState(statement);
  const currentUserQuery = useCurrentUser();
  const paymentMethodsQuery = useAccountingPaymentMethods(open);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, open);
  const createJournal = useCreateDailyIncomeJournal();
  const createStatement = useCreateIncomeStatement();
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

  const statementForm = useForm<DailyIncomeStatementValues>({
    resolver: zodResolver(dailyIncomeStatementSchema),
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
    reset(DEFAULT_VALUES);
    setSubmitError(null);
    setStatementError(null);
    setCardFlipped(false);
    setActiveStatement(statement);
  }, [open, reset, statement]);

  useEffect(() => {
    const branch = currentUserQuery.data?.branch;
    if (!open || !branch) return;
    statementForm.reset({
      date,
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      currency: "USD",
      rate: 1,
    });
  }, [currentUserQuery.data?.branch, date, open, statementForm]);

  const amount = watch("amount") ?? 0;
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const paymentAccountId = watch("paymentAccountId");
  const paymentRequired = amount > 0;
  const needsBankAccount = paymentRequired && requiresBankAccount(paymentMethodName);
  const isZelle = paymentRequired && isZellePaymentMethod(paymentMethodName);
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const statementOpen = activeStatement?.status === "OPEN";
  const statementCurrency = statementForm.watch("currency");

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
      setSubmitError("Today’s Daily Income must be open before registering this invoice.");
      return;
    }
    if (!currentUser) {
      setSubmitError("Current employee information is not available.");
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
            Register this invoice in today&apos;s Daily Income before continuing.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <div
            className="relative transition-[height] duration-300 [perspective:1200px]"
            style={{ height: cardFlipped ? 286 : 164 }}
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
                    <p className="font-semibold">Today&apos;s Daily Income</p>
                    {activeStatement ? (
                      <>
                        <div className="flex items-center gap-2">
                          {statementOpen ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="size-4 text-amber-600" />
                          )}
                          <span className="font-medium">Daily income #{activeStatement.id}</span>
                          <span className={statementOpen ? "text-emerald-700" : "text-amber-700"}>
                            · {statementOpen ? "Open" : "Closed"}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {activeStatement.date} · {activeStatement.branch?.name || activeStatement.branch?.code || "Current branch"}
                        </p>
                        <div className="flex gap-8 text-xs text-muted-foreground">
                          <span>Currency <strong className="text-foreground">{activeStatement.currency}</strong></span>
                          <span>Rate <strong className="text-foreground">{activeStatement.rate.toFixed(2)}</strong></span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertCircle className="size-4" />
                          <span className="font-medium">No Daily Income exists for today</span>
                        </div>
                        <p className="text-muted-foreground">
                          Create it here to enable invoice registration and payment entry.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <Button
                      data-testid="invoice-daily-income-flip-create"
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(activeStatement)}
                      onClick={() => setCardFlipped(true)}
                    >
                      <RotateCcw className="size-4" />
                      Create daily income
                    </Button>
                    {activeStatement ? (
                      <p className="mt-1 text-xs text-muted-foreground">Already created</p>
                    ) : null}
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
                    <p className="font-semibold">Create daily income</p>
                    <p className="text-xs text-muted-foreground">
                      Create today&apos;s closeout for the current branch without leaving the wizard.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-date">Date</Label>
                      <Input id="invoice-statement-date" value={date} disabled />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-branch">Branch</Label>
                      <Input
                        id="invoice-statement-branch"
                        value={currentUserQuery.data?.branch.name || currentUserQuery.data?.branch.code || "Loading branch…"}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-currency">Currency</Label>
                      <SearchableSelect
                        id="invoice-statement-currency"
                        value={statementCurrency}
                        onValueChange={(next) => statementForm.setValue("currency", next, { shouldValidate: true })}
                        options={[
                          { value: "USD", label: "Dollar (USD)" },
                          { value: "DOP", label: "Peso (DOP)" },
                        ]}
                        placeholder="Select currency"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-statement-rate">Exchange rate</Label>
                      <Input
                        id="invoice-statement-rate"
                        type="number"
                        min={0}
                        step="0.01"
                        {...statementForm.register("rate", { valueAsNumber: true })}
                      />
                      {statementForm.formState.errors.rate ? (
                        <p className="text-xs text-destructive">
                          {statementForm.formState.errors.rate.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {statementError ? <p className="text-xs text-destructive">{statementError}</p> : null}
                  <div className="flex justify-between gap-2 border-t border-blue-200 pt-3 dark:border-blue-900">
                    <Button type="button" size="sm" variant="outline" onClick={() => setCardFlipped(false)}>
                      <RotateCcw className="size-4" />
                      Back to status
                    </Button>
                    <Button
                      data-testid="invoice-daily-income-create"
                      type="button"
                      size="sm"
                      disabled={createStatement.isPending || !currentUserQuery.data}
                      onClick={statementForm.handleSubmit(createDailyIncome)}
                    >
                      {createStatement.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      {createStatement.isPending ? "Creating…" : "Create daily income"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {activeStatement && !statementOpen ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Today&apos;s Daily Income is closed. Payment entry remains disabled until it is reopened.
            </div>
          ) : null}

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
                disabled={!statementOpen}
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
                  disabled={!statementOpen || !paymentRequired}
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
                  disabled={!statementOpen || !needsBankAccount}
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
              <Input id="daily-income-description" disabled={!statementOpen} {...register("description")} />
              {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!statementOpen || createJournal.isPending || currentUserQuery.isLoading}
            >
              {createJournal.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {createJournal.isPending ? "Registering…" : "Register & continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
