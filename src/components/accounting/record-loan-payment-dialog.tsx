"use client";

import { useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Banknote, Landmark, ReceiptText, User } from "lucide-react";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useEmployeeActiveLoans } from "@/lib/accounting/loans/hooks";
import { formatLoanDate, formatLoanMoney } from "@/lib/accounting/loans/display";
import { allocateLoanPayment, sortLoansOldestFirst, type LoanPaymentAllocation } from "@/lib/accounting/loans/payment-allocation";
import { createLoanPaymentSchema } from "@/lib/accounting/loans/schemas";
import type { Loan, LoanPaymentAllocationMode, LoanPaymentValues } from "@/lib/accounting/loans/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: number; name: string }>;
  loans: Loan[];
  assetAccounts: ChartAccount[];
  onSubmit: (values: LoanPaymentValues) => Promise<void>;
  pending: boolean;
  initialLoan: Loan | null;
};

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function accountLabel(account?: { displayName?: string; name: string }) {
  return account ? account.displayName ?? account.name : "";
}

export function RecordLoanPaymentDialog(props: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!props.pending) props.onOpenChange(open); }}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>{t("accounting.loans.paymentForm.title")}</DialogTitle>
          <DialogDescription>{t("accounting.loans.paymentForm.description")}</DialogDescription>
        </DialogHeader>
        {props.open ? <RecordLoanPaymentForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RecordLoanPaymentForm({ employees, loans, assetAccounts, initialLoan, pending, onSubmit, onOpenChange }: Props) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.loans.paymentForm.${key}`, values);
  const schema = useMemo(() => createLoanPaymentSchema(t), [t]);
  const handleEnterNavigation = useFormEnterNavigation();
  const submitting = useRef(false);
  const form = useForm<LoanPaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      allocationMode: initialLoan ? "specific-loan" : "oldest-first",
      loanId: initialLoan?.id,
      employeeId: initialLoan?.employee.id ?? 0,
      employeeName: initialLoan?.employee.name,
      receivedAccountId: 0,
      amount: 0,
      transactionDate: todayInputValue(),
      referenceNumber: "",
      description: "",
    },
  });
  const { register, setValue, watch, formState: { errors } } = form;
  const busy = pending || form.formState.isSubmitting;
  const allocationMode = watch("allocationMode");
  const selectedEmployeeId = watch("employeeId");
  const selectedLoanId = watch("loanId");
  const receivedAccountId = watch("receivedAccountId");
  const receivedAccountName = watch("receivedAccountName") ?? "";
  const amount = watch("amount") ?? 0;

  const employeeLoansQuery = useEmployeeActiveLoans(selectedEmployeeId);
  const employeeLoans = useMemo(
    () => sortLoansOldestFirst(employeeLoansQuery.data?.items ?? []),
    [employeeLoansQuery.data],
  );
  const loanOptionsSource = useMemo(
    () => (selectedEmployeeId ? employeeLoans : sortLoansOldestFirst(loans.filter((loan) => loan.status === "ACTIVE"))),
    [employeeLoans, loans, selectedEmployeeId],
  );
  const selectedLoan =
    loanOptionsSource.find((loan) => loan.id === selectedLoanId) ??
    (selectedLoanId && initialLoan?.id === selectedLoanId ? initialLoan : undefined);
  const allocationLoans = allocationMode === "specific-loan" ? (selectedLoan ? [selectedLoan] : []) : employeeLoans;
  const allocation = allocateLoanPayment(allocationLoans, amount);
  const creditedLoans = allocation.rows.filter((row) => row.applied > 0).map((row) => row.loan);
  const creditAccountName = Array.from(
    new Set((creditedLoans.length > 0 ? creditedLoans : allocationLoans.slice(0, 1)).map((loan) => accountLabel(loan.loanAccount)).filter(Boolean)),
  ).join(", ");
  const noActiveLoans = selectedEmployeeId > 0 && employeeLoansQuery.isSuccess && employeeLoans.length === 0;

  const fieldError = (name: keyof LoanPaymentValues) =>
    errors[name] ? <p role="alert" className="text-sm text-destructive">{errors[name]?.message}</p> : null;
  const requiredLabel = (id: string, label: string) => (
    <Label htmlFor={id}>{label}<span className="text-destructive"> *</span></Label>
  );

  const submit = form.handleSubmit(async (values) => {
    if (submitting.current || pending) return;
    submitting.current = true;
    form.clearErrors("root.server");
    try {
      await onSubmit(values);
    } catch (error) {
      form.setError("root.server", { message: normalizeApiError(error).message });
    } finally {
      submitting.current = false;
    }
  });

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onKeyDown={handleEnterNavigation} onSubmit={submit}>
      <FormBody workflow isBusy={busy}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <FormSection
            variant="card"
            icon={User}
            title={text("sections.employee")}
            description={allocationMode === "specific-loan" ? text("specificLoanHint") : text("oldestFirstHint")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {requiredLabel("loan-payment-employee", text("employee"))}
                <SearchableSelect
                  id="loan-payment-employee"
                  aria-label={text("employee")}
                  aria-invalid={Boolean(errors.employeeId)}
                  value={selectedEmployeeId ? String(selectedEmployeeId) : ""}
                  onValueChange={(next) => {
                    const employee = employees.find((item) => item.id === Number(next));
                    setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                    setValue("employeeName", employee?.name ?? "");
                    setValue("loanId", undefined, { shouldValidate: allocationMode === "specific-loan" });
                  }}
                  options={employees.map((employee) => ({
                    value: String(employee.id),
                    label: employee.name,
                    keywords: [employee.name],
                  }))}
                  placeholder={text("selectEmployee")}
                  searchPlaceholder={text("searchEmployees")}
                  mobileSheet
                />
                {fieldError("employeeId")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-payment-allocation", text("allocationMode"))}
                <SegmentedControl<LoanPaymentAllocationMode>
                  id="loan-payment-allocation"
                  aria-label={text("allocationMode")}
                  value={allocationMode}
                  disabled={busy}
                  options={[
                    { value: "oldest-first", label: text("oldestFirst") },
                    { value: "specific-loan", label: text("specificLoan") },
                  ]}
                  onValueChange={(next) => setValue("allocationMode", next, { shouldValidate: true })}
                />
              </div>
              {allocationMode === "specific-loan" ? (
                <div className="space-y-2 sm:col-span-2">
                  {requiredLabel("loan-payment-loan", text("loan"))}
                  <SearchableSelect
                    id="loan-payment-loan"
                    aria-label={text("loan")}
                    aria-invalid={Boolean(errors.loanId)}
                    value={selectedLoanId ?? ""}
                    onValueChange={(next) => {
                      const loan = loanOptionsSource.find((item) => item.id === next);
                      setValue("loanId", loan?.id, { shouldValidate: true });
                      if (loan && !selectedEmployeeId) {
                        setValue("employeeId", loan.employee.id, { shouldValidate: true });
                        setValue("employeeName", loan.employee.name);
                      }
                    }}
                    options={loanOptionsSource.map((loan) => ({
                      value: loan.id,
                      label: `${loan.employee.name} - ${loan.description || t("accounting.loans.fallbackDescription")}`,
                      description: text("loanOptionDescription", {
                        opened: formatLoanDate(loan.openedAt) || t("common.empty.dash"),
                        balance: formatLoanMoney(loan.balance),
                      }),
                      keywords: [loan.employee.name, loan.description, loan.referenceNumber],
                    }))}
                    placeholder={text("selectLoan")}
                    searchPlaceholder={text("searchLoans")}
                    loading={selectedEmployeeId > 0 && employeeLoansQuery.isPending}
                    mobileSheet
                  />
                  {fieldError("loanId")}
                </div>
              ) : null}
            </div>
          </FormSection>

          <FormSection variant="card" icon={Landmark} title={text("sections.balances")}>
            <LoanBalancesSummary
              allocation={allocation}
              mode={allocationMode}
              amount={amount}
              employeeSelected={selectedEmployeeId > 0}
              loading={selectedEmployeeId > 0 && employeeLoansQuery.isPending && allocationLoans.length === 0}
              error={employeeLoansQuery.isError}
            />
          </FormSection>

          <FormSection variant="card" icon={ReceiptText} title={text("sections.payment")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {requiredLabel("loan-payment-received-account", text("receivedAccount"))}
                <SearchableSelect
                  id="loan-payment-received-account"
                  aria-label={text("receivedAccount")}
                  aria-invalid={Boolean(errors.receivedAccountId)}
                  value={receivedAccountId ? String(receivedAccountId) : ""}
                  onValueChange={(next) => {
                    const account = assetAccounts.find((item) => item.id === Number(next));
                    setValue("receivedAccountId", account?.id ?? 0, { shouldValidate: true });
                    setValue("receivedAccountName", accountLabel(account));
                    setValue("receivedAccountType", account?.type);
                  }}
                  options={assetAccounts.map((account) => ({
                    value: String(account.id),
                    label: accountLabel(account),
                    keywords: [account.name, account.displayName ?? ""],
                  }))}
                  placeholder={text("selectReceivedAccount")}
                  searchPlaceholder={text("searchAssetAccounts")}
                  mobileSheet
                />
                {fieldError("receivedAccountId")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-payment-amount", text("amount"))}
                <Input
                  id="loan-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  aria-invalid={Boolean(errors.amount)}
                  {...register("amount", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                />
                {fieldError("amount")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-payment-date", text("date"))}
                <DateInput id="loan-payment-date" aria-invalid={Boolean(errors.transactionDate)} {...register("transactionDate")} />
                {fieldError("transactionDate")}
              </div>
            </div>
          </FormSection>

          <FormSection variant="card" title={text("sections.notes")}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loan-payment-reference">{text("reference")}</Label>
                <Input id="loan-payment-reference" placeholder={text("optional")} {...register("referenceNumber")} />
                {fieldError("referenceNumber")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-payment-description">{text("notes")}</Label>
                <textarea
                  id="loan-payment-description"
                  rows={3}
                  className={textareaClassName}
                  placeholder={text("notesPlaceholder")}
                  {...register("description")}
                />
                {fieldError("description")}
              </div>
            </div>
          </FormSection>

          <FormSection variant="card" icon={Banknote} title={text("sections.journal")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <JournalLine label={text("journalDebit")} account={receivedAccountName} amount={amount} />
              <JournalLine label={text("journalCredit")} account={creditAccountName} amount={amount} />
            </div>
          </FormSection>
        </fieldset>
      </FormBody>
      <FormFooter
        error={errors.root?.server?.message}
        warning={noActiveLoans ? text("balances.empty") : null}
        isSubmitting={busy}
        submitLabel={text("submit")}
        onCancel={() => onOpenChange(false)}
      />
    </form>
  );
}

function JournalLine({ label, account, amount }: { label: string; account: string; amount: number }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium", !account && "text-muted-foreground")}>
        {account || t("accounting.loans.journalPreview.selectAccount")}
      </p>
      <p className="text-lg font-semibold tabular-nums">{formatLoanMoney(amount)}</p>
    </div>
  );
}

function BalanceTile({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-muted/20 p-3", emphasis && "border-primary/30 bg-primary/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", emphasis && "text-primary")}>{formatLoanMoney(value)}</p>
    </div>
  );
}

function LoanBalancesSummary({
  allocation,
  mode,
  amount,
  employeeSelected,
  loading,
  error,
}: {
  allocation: LoanPaymentAllocation;
  mode: LoanPaymentAllocationMode;
  amount: number;
  employeeSelected: boolean;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.loans.paymentForm.balances.${key}`, values);
  const { rows, totals, unapplied } = allocation;

  if (error && rows.length === 0) return <p role="alert" className="text-sm text-destructive">{text("loadError")}</p>;
  if (loading) return <p className="text-sm text-muted-foreground">{text("loading")}</p>;
  if (rows.length === 0) {
    const message = mode === "specific-loan" ? text("selectLoan") : employeeSelected ? text("empty") : text("selectEmployee");
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  const showBreakdown = mode === "oldest-first";

  return (
    <div className="space-y-4">
      {showBreakdown ? <p className="text-sm text-muted-foreground">{text("totalsHint", { count: rows.length })}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <BalanceTile label={text("originalAmount")} value={totals.principalAmount} />
        <BalanceTile label={text("paidSoFar")} value={totals.paidAmount} />
        <BalanceTile label={text("currentBalance")} value={totals.balance} emphasis />
      </div>

      {showBreakdown ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">{text("loan")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{text("originalAmount")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{text("paidSoFar")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{text("currentBalance")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{text("thisPayment")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{text("balanceAfter")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ loan, applied, balanceAfter }, index) => (
                <tr key={loan.id} className={cn(applied > 0 && "bg-primary/5")}>
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {index + 1}. {loan.description || t("accounting.loans.fallbackDescription")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {text("opened", { date: formatLoanDate(loan.openedAt) || t("common.empty.dash") })}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatLoanMoney(loan.principalAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatLoanMoney(loan.paidAmount)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatLoanMoney(loan.balance)}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", applied > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {formatLoanMoney(applied)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatLoanMoney(balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {amount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span>
            <span className="text-muted-foreground">{text("thisPayment")} </span>
            <span className="font-semibold tabular-nums">{formatLoanMoney(totals.applied)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{text("balanceAfter")} </span>
            <span className="font-semibold tabular-nums">{formatLoanMoney(totals.balanceAfter)}</span>
          </span>
        </div>
      ) : null}
      {unapplied > 0 ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {text("overpayment", { amount: formatLoanMoney(unapplied) })}
        </p>
      ) : null}
    </div>
  );
}
