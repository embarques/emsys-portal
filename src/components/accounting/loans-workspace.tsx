"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  ReceiptText,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCreateLoan, useLoans, useLoanTransactions, useRecordLoanPayment } from "@/lib/accounting/loans/hooks";
import {
  formatLoanDate,
  formatLoanMoney,
  loanStatusLabel,
} from "@/lib/accounting/loans/display";
import { LOAN_TABLE_FILTER_FIELDS } from "@/lib/accounting/loans/filter-fields";
import { createLoanPaymentSchema } from "@/lib/accounting/loans/schemas";
import {
  DEFAULT_LOAN_LIST_PARAMS,
  EMPTY_LOAN_SUMMARY,
  type Loan,
  type LoanCreateValues,
  type LoanPaymentValues,
  type LoanTransaction,
} from "@/lib/accounting/loans/types";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useGenerateLoanReport } from "@/lib/reports/hooks/use-reports";
import {
  buildSelectedLoansReportRequest,
  downloadLoanExcelReport,
  openLoanReportUrl,
} from "@/lib/accounting/loans/print-loan-report";
import { CreateLoanDialog } from "@/components/accounting/create-loan-dialog";
import { useTranslation } from "@/lib/i18n";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";
import type { TranslateFn } from "@/lib/feedback/messages";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const LOANS_TABLE_COLUMN_STORAGE_KEY = "accounting-loans-v1";

function loanMutationErrorMessage(error: unknown, t: TranslateFn): string {
  const message = normalizeApiError(error).message;
  if (/open (daily )?income (statement|closeout)/i.test(message)) {
    return t("accounting.loans.errors.openCloseoutRequired");
  }
  return message;
}

type LoanFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

const defaultFilters: LoanFilterState = {
  query: "",
  rows: [],
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function loanStatusClassName(status: Loan["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-transparent bg-emerald-100 text-emerald-700";
    case "PAID":
      return "border-transparent bg-slate-100 text-slate-700";
    case "VOID":
      return "border-transparent bg-rose-100 text-rose-700";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

function RequiredLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

function accountLabel(account: { displayName?: string; name: string }) {
  return account.displayName ?? account.name;
}

function LoanJournalPreview({
  debitAccount,
  creditAccount,
  amount,
  transactionLabel,
}: {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  transactionLabel: "ISSUE" | "PAYMENT";
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-semibold">{t("accounting.loans.journalPreview.title")}</p>
      <div className="mt-3 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="font-semibold">{t("accounting.loans.journalPreview.debit")}</p>
            <p className="text-muted-foreground">{debitAccount || t("accounting.loans.journalPreview.selectAccount")}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatLoanMoney(amount)}</p>
        </div>
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="font-semibold">{t("accounting.loans.journalPreview.credit")}</p>
            <p className="text-muted-foreground">{creditAccount || t("accounting.loans.journalPreview.selectAccount")}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatLoanMoney(amount)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-medium text-muted-foreground">{t("accounting.loans.journalPreview.transactionType")}</p>
            <p className="mt-1 font-semibold">LOAN</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">{t("accounting.loans.journalPreview.loanTransaction")}</p>
            <p className="mt-1 font-semibold">{transactionLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  employees,
  loans,
  assetAccounts,
  onSubmit,
  pending,
  initialLoan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: number; name: string }>;
  loans: Loan[];
  assetAccounts: ChartAccount[];
  onSubmit: (values: LoanPaymentValues) => Promise<void>;
  pending: boolean;
  initialLoan: Loan | null;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => createLoanPaymentSchema(t), [t]);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<LoanPaymentValues>({
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
  const allocationMode = watch("allocationMode");
  const selectedEmployeeId = watch("employeeId");
  const selectedLoanId = watch("loanId");
  const amount = watch("amount") ?? 0;
  const receivedAccountName = watch("receivedAccountName") ?? "";
  const employeeLoans = loans.filter(
    (loan) => loan.status === "ACTIVE" && (!selectedEmployeeId || loan.employee.id === selectedEmployeeId),
  );
  const selectedLoan = selectedLoanId ? loans.find((loan) => loan.id === selectedLoanId) : undefined;
  const creditAccountName =
    allocationMode === "specific-loan"
      ? selectedLoan?.loanAccount?.displayName ?? selectedLoan?.loanAccount?.name ?? ""
      : employeeLoans[0]?.loanAccount?.displayName ?? employeeLoans[0]?.loanAccount?.name ?? "";
  const allocationPreview =
    allocationMode === "specific-loan" && selectedLoan
      ? t("accounting.loans.paymentForm.allocationPart", {
          amount: formatLoanMoney(Math.min(amount, selectedLoan.balance)),
          loan: selectedLoan.description || selectedLoan.id,
        })
      : buildOldestFirstAllocationPreview(employeeLoans, amount, t);

  useEffect(() => {
    if (!open) return;
    reset({
      allocationMode: initialLoan ? "specific-loan" : "oldest-first",
      loanId: initialLoan?.id,
      employeeId: initialLoan?.employee.id ?? 0,
      employeeName: initialLoan?.employee.name,
      receivedAccountId: 0,
      amount: 0,
      transactionDate: todayInputValue(),
      referenceNumber: "",
      description: "",
    });
  }, [initialLoan, open, reset]);

  function closeDialog(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset({
        allocationMode: "oldest-first",
        employeeId: 0,
        receivedAccountId: 0,
        amount: 0,
        transactionDate: todayInputValue(),
        referenceNumber: "",
        description: "",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t("accounting.loans.paymentForm.title")}</DialogTitle>
          <DialogDescription>{t("accounting.loans.paymentForm.description")}</DialogDescription>
        </DialogHeader>
        <form
          id="loan-payment-form"
          className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>{t("accounting.loans.paymentForm.employee")}</RequiredLabel>
              <SearchableSelect
                value={selectedEmployeeId ? String(selectedEmployeeId) : ""}
                onValueChange={(next) => {
                  const employee = employees.find((item) => item.id === Number(next));
                  setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                  setValue("employeeName", employee?.name ?? "");
                  setValue("loanId", undefined, { shouldValidate: true });
                }}
                options={employees.map((employee) => ({
                  value: String(employee.id),
                  label: employee.name,
                  keywords: [employee.name],
                }))}
                placeholder={t("accounting.loans.paymentForm.selectEmployee")}
                searchPlaceholder={t("accounting.loans.paymentForm.searchEmployees")}
                mobileSheet
              />
              {errors.employeeId ? <p className="text-sm text-destructive">{errors.employeeId.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>{t("accounting.loans.paymentForm.allocationMode")}</RequiredLabel>
              <div className="grid grid-cols-2 rounded-lg border bg-muted/20 p-1">
                {[
                  { value: "oldest-first", label: t("accounting.loans.paymentForm.oldestFirst") },
                  { value: "specific-loan", label: t("accounting.loans.paymentForm.specificLoan") },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "h-9 rounded-md text-sm font-medium",
                      allocationMode === option.value
                        ? "bg-background text-primary shadow-xs"
                        : "text-muted-foreground",
                    )}
                    onClick={() =>
                      setValue("allocationMode", option.value as LoanPaymentValues["allocationMode"], {
                        shouldValidate: true,
                      })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {allocationMode === "specific-loan" ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel>{t("accounting.loans.paymentForm.loan")}</RequiredLabel>
                <SearchableSelect
                  value={selectedLoanId ?? ""}
                  onValueChange={(next) => setValue("loanId", next, { shouldValidate: true })}
                  options={employeeLoans.map((loan) => ({
                    value: loan.id,
                    label: `${loan.employee.name} - ${loan.description || loan.id}`,
                    description: t("accounting.loans.paymentForm.loanBalance", { amount: formatLoanMoney(loan.balance) }),
                    keywords: [loan.employee.name, loan.description, loan.referenceNumber],
                  }))}
                  placeholder={t("accounting.loans.paymentForm.selectLoan")}
                  searchPlaceholder={t("accounting.loans.paymentForm.searchLoans")}
                  mobileSheet
                />
                {errors.loanId ? <p className="text-sm text-destructive">{errors.loanId.message}</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel>{t("accounting.loans.paymentForm.receivedAccount")}</RequiredLabel>
              <SearchableSelect
                value={watch("receivedAccountId") ? String(watch("receivedAccountId")) : ""}
                onValueChange={(next) => {
                  const account = assetAccounts.find((item) => item.id === Number(next));
                  setValue("receivedAccountId", account?.id ?? 0, { shouldValidate: true });
                  setValue("receivedAccountName", account ? accountLabel(account) : "");
                  setValue("receivedAccountType", account?.type);
                }}
                options={assetAccounts.map((account) => ({
                  value: String(account.id),
                  label: accountLabel(account),
                  keywords: [account.name, account.displayName],
                }))}
                placeholder={t("accounting.loans.paymentForm.selectReceivedAccount")}
                searchPlaceholder={t("accounting.loans.paymentForm.searchAssetAccounts")}
                mobileSheet
              />
              {errors.receivedAccountId ? <p className="text-sm text-destructive">{errors.receivedAccountId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-payment-amount">{t("accounting.loans.paymentForm.amount")}</RequiredLabel>
              <Input
                id="loan-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                {...register("amount", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>

            {allocationPreview ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:col-span-2">
                {t("accounting.loans.paymentForm.allocation", { allocation: allocationPreview })}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-payment-date">{t("accounting.loans.paymentForm.date")}</RequiredLabel>
              <DateInput id="loan-payment-date" {...register("transactionDate")} />
              {errors.transactionDate ? <p className="text-sm text-destructive">{errors.transactionDate.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan-payment-reference">{t("accounting.loans.paymentForm.reference")}</Label>
              <Input id="loan-payment-reference" placeholder={t("accounting.loans.paymentForm.optional")} {...register("referenceNumber")} />
              {errors.referenceNumber ? <p className="text-sm text-destructive">{errors.referenceNumber.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="loan-payment-description">{t("accounting.loans.paymentForm.notes")}</Label>
              <textarea
                id="loan-payment-description"
                rows={4}
                className="flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder={t("accounting.loans.paymentForm.notesPlaceholder")}
                {...register("description")}
              />
              {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
            </div>
          </div>
          <LoanJournalPreview
            debitAccount={receivedAccountName}
            creditAccount={creditAccountName}
            amount={amount}
            transactionLabel="PAYMENT"
          />
        </form>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" form="loan-payment-form" disabled={pending}>
            {t("accounting.loans.paymentForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildOldestFirstAllocationPreview(loans: Loan[], amount: number, t: TranslateFn) {
  if (amount <= 0 || loans.length === 0) return "";
  let remaining = amount;
  const parts: string[] = [];
  for (const loan of [...loans].sort((left, right) => left.openedAt.localeCompare(right.openedAt))) {
    if (remaining <= 0) break;
    const applied = Math.min(loan.balance, remaining);
    if (applied > 0) {
      parts.push(
        t("accounting.loans.paymentForm.allocationPart", {
          amount: formatLoanMoney(applied),
          loan: loan.description || loan.id,
        }),
      );
      remaining -= applied;
    }
  }
  return parts.join(", ");
}

function LoanMobileCard({
  loan,
  selected,
  onSelect,
  onRecordPayment,
  onViewPayments,
}: {
  loan: Loan;
  selected: boolean;
  onSelect: (loan: Loan) => void;
  onRecordPayment: (loan: Loan) => void;
  onViewPayments: (loan: Loan) => void;
}) {
  const { t } = useTranslation();
  const hasPayments = loan.paidAmount > 0;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors",
        selected && "border-primary bg-primary/5",
      )}
    >
      <button type="button" className="w-full text-left" onClick={() => onSelect(loan)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{loan.employee.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{loan.description || t("accounting.loans.fallbackDescription")}</p>
          </div>
          <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status, t)}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("accounting.loans.details.balance")}</p>
            <p className="font-semibold">{formatLoanMoney(loan.balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("accounting.loans.details.principal")}</p>
            <p className="font-semibold">{formatLoanMoney(loan.principalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("accounting.loans.details.loanAccount")}</p>
            <p className="truncate font-medium">{loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("accounting.loans.details.lastActivity")}</p>
            <p className="font-medium">{formatLoanDate(loan.lastActivityAt) || "-"}</p>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3">
        {hasPayments ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label={t("accounting.loans.payments.viewAria", { name: loan.employee.name })}
            onClick={() => onViewPayments(loan)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          type="button"
          className="h-9 rounded-lg px-3 text-sm"
          onClick={() => onRecordPayment(loan)}
        >
          {t("accounting.loans.actions.newLoanPayment")}
        </Button>
      </div>
    </div>
  );
}

function LoanPaymentEntries({
  payments,
  loading,
  error,
  emptyMessage,
  loadingMessage,
  refLabel,
  createdByTemplate,
  compact = false,
}: {
  payments: LoanTransaction[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  loadingMessage: string;
  refLabel: string;
  createdByTemplate: (name: string) => string;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  if (error) {
    return (
      <div
        className={cn(
          "text-sm text-destructive",
          compact ? "mt-3" : "rounded-2xl border border-destructive/30 bg-destructive/5 p-4",
        )}
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <p className={cn("text-sm text-muted-foreground", compact ? "mt-3" : "rounded-2xl border bg-card p-5")}>
        {loadingMessage}
      </p>
    );
  }

  if (payments.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", compact ? "mt-3" : "rounded-2xl border bg-card p-5")}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn(compact ? "mt-3 space-y-3" : "space-y-3")}>
      {payments.map((payment) => (
        <div
          key={payment.id}
          className={cn(
            "border bg-card",
            compact ? "rounded-lg bg-muted/20 p-3" : "rounded-2xl p-4 shadow-sm",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn(compact ? "text-sm font-medium" : "font-semibold")}>
                {formatLoanDate(payment.transactionDate) || "-"}
              </p>
              <p className={cn("mt-1 truncate text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                {payment.assetAccount?.displayName ?? payment.assetAccount?.name ?? t("accounting.loans.transactionTypes.PAYMENT")}
              </p>
            </div>
            <p className={cn("shrink-0", compact ? "text-sm font-semibold" : "font-bold")}>
              {formatLoanMoney(payment.amount)}
            </p>
          </div>
          {payment.referenceNumber || payment.description || payment.createdBy ? (
            <div className={cn("space-y-1", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>
              {payment.referenceNumber ? (
                <p>
                  <span className="text-muted-foreground">{refLabel} </span>
                  <span className="font-medium">{payment.referenceNumber}</span>
                </p>
              ) : null}
              {payment.description ? (
                <p className={cn("text-muted-foreground", compact && "line-clamp-2")}>{payment.description}</p>
              ) : null}
              {!compact && payment.createdBy ? (
                <p className="text-muted-foreground">{createdByTemplate(payment.createdBy)}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LoanPaymentsMobileView({
  loan,
  payments,
  loading,
  error,
  onBack,
  onRecordPayment,
  labels,
}: {
  loan: Loan;
  payments: LoanTransaction[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRecordPayment: (loan: Loan) => void;
  labels: {
    title: string;
    paidLabel: string;
    balanceLabel: string;
    empty: string;
    loading: string;
    refLabel: string;
    createdBy: (name: string) => string;
  };
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 px-4 pb-8">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-normal">{loan.employee.name}</h2>
          <p className="text-sm text-muted-foreground">{labels.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{labels.paidLabel}</p>
          <p className="mt-1 text-lg font-bold">{formatLoanMoney(loan.paidAmount)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{labels.balanceLabel}</p>
          <p className="mt-1 text-lg font-bold">{formatLoanMoney(loan.balance)}</p>
        </div>
      </div>

      <Button type="button" className="w-full rounded-xl" onClick={() => onRecordPayment(loan)} disabled={loan.status !== "ACTIVE"}>
        <ReceiptText className="h-4 w-4" />
        {t("accounting.loans.actions.newLoanPayment")}
      </Button>

      <LoanPaymentEntries
        payments={payments}
        loading={loading}
        error={error}
        emptyMessage={labels.empty}
        loadingMessage={labels.loading}
        refLabel={labels.refLabel}
        createdByTemplate={labels.createdBy}
      />
    </div>
  );
}

function LoanPaymentsDesktopPanel({
  loan,
  payments,
  loading,
  error,
  onBack,
  onRecordPayment,
  labels,
}: {
  loan: Loan;
  payments: LoanTransaction[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRecordPayment: (loan: Loan) => void;
  labels: {
    title: string;
    subtitle: string;
    back: string;
    paidLabel: string;
    balanceLabel: string;
    empty: string;
    loading: string;
    refLabel: string;
    createdBy: (name: string) => string;
  };
}) {
  const { t } = useTranslation();

  return (
    <>
      <CardHeader className="gap-3 border-b py-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              {labels.back}
            </Button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{loan.employee.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {loan.description || labels.title} · {labels.subtitle}
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => onRecordPayment(loan)} disabled={loan.status !== "ACTIVE"}>
            <ReceiptText className="h-4 w-4" />
            {t("accounting.loans.actions.newLoanPayment")}
          </Button>
        </div>
      </CardHeader>

      <div className="space-y-4 px-6 py-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{labels.paidLabel}</p>
            <p className="mt-1 text-lg font-semibold">{formatLoanMoney(loan.paidAmount)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{labels.balanceLabel}</p>
            <p className="mt-1 text-lg font-semibold">{formatLoanMoney(loan.balance)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{labels.title}</p>
            <p className="mt-1 text-lg font-semibold">{payments.length}</p>
          </div>
        </div>

        <LoanPaymentEntries
          payments={payments}
          loading={loading}
          error={error}
          emptyMessage={labels.empty}
          loadingMessage={labels.loading}
          refLabel={labels.refLabel}
          createdByTemplate={labels.createdBy}
        />
      </div>
    </>
  );
}

export function LoansWorkspace() {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const [filters, setFilters] = useState<LoanFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInitialLoan, setPaymentInitialLoan] = useState<Loan | null>(null);
  const [paymentHistoryLoan, setPaymentHistoryLoan] = useState<Loan | null>(null);
  const debouncedQuery = useDebouncedValue(filters.query, 250);
  const { sort, onSortChange } = useTableSort(DEFAULT_LOAN_LIST_PARAMS.sort, () => setPage(1));
  const search = createApiListTextSearch(debouncedQuery);
  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort,
      search,
      filterRows: filters.rows,
    }),
    [filters.rows, page, search, sort],
  );
  const loansQuery = useLoans(listParams);
  const transactionHistoryLoan = paymentHistoryLoan ?? selectedLoan;
  const loanTransactionsQuery = useLoanTransactions(
    transactionHistoryLoan?.id ?? null,
    Boolean(transactionHistoryLoan),
  );
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500, sort: "displayName:asc" });
  const createLoanMutation = useCreateLoan();
  const recordPaymentMutation = useRecordLoanPayment();
  const generateLoanReportMutation = useGenerateLoanReport();
  const loans = loansQuery.data?.items ?? [];
  const summary = loansQuery.data?.summary ?? EMPTY_LOAN_SUMMARY;
  const totalLoans = loansQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLoans / PAGE_SIZE));
  const pageRowIds = useMemo(() => loans.map((loan) => loan.id), [loans]);
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
  const selectedLoansOnPage = useMemo(
    () => loans.filter((loan) => selectedIds.includes(loan.id)),
    [loans, selectedIds],
  );
  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, filters.rows, sort), setSelectedIds);
  const paymentTransactions = useMemo(
    () =>
      (loanTransactionsQuery.data ?? [])
        .filter((transaction) => transaction.type === "PAYMENT")
        .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)),
    [loanTransactionsQuery.data],
  );
  const paymentLabels = useMemo(
    () => ({
      title: t("accounting.loans.payments.title"),
      subtitle: t("accounting.loans.payments.subtitle"),
      view: t("accounting.loans.payments.view"),
      back: t("accounting.loans.payments.back"),
      paidLabel: t("accounting.loans.payments.paidLabel"),
      balanceLabel: t("accounting.loans.payments.balanceLabel"),
      empty: t("accounting.loans.payments.empty"),
      loading: t("accounting.loans.payments.loading"),
      loadError: t("accounting.loans.payments.loadError"),
      noneRecorded: t("accounting.loans.payments.noneRecorded"),
      refLabel: t("accounting.loans.payments.refLabel"),
      createdBy: (name: string) => t("accounting.loans.payments.createdBy", { name }),
    }),
    [t],
  );
  const paymentHistoryError = loanTransactionsQuery.isError
    ? loanTransactionsQuery.error instanceof Error
      ? loanTransactionsQuery.error.message
      : paymentLabels.loadError
    : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, LOAN_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const employees = employeesQuery.data?.items ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const loanAccounts = accounts.filter((account) => account.type === "LOAN");
  const assetAccounts = accounts.filter((account) => account.type === "ASSET" || account.type === "BANK");
  const loanAccountFilterOptions = loanAccounts.map((account) => ({
    value: String(account.id),
    label: accountLabel(account),
  }));
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: loans.length,
      page,
      pageSize: PAGE_SIZE,
      total: totalLoans,
      noun: t("accounting.loans.noun"),
      isLoading: loansQuery.isFetching,
    },
    t,
  );
  const searchResultHint = hasActiveFilters ? listSummary : undefined;
  const stats = [
    {
      label: t("accounting.loans.stats.outstandingBalance"),
      value: formatLoanMoney(summary.outstandingBalance),
      description: t("accounting.loans.stats.outstandingBalanceDescription"),
      icon: Banknote,
    },
    {
      label: t("accounting.loans.stats.loanedInRange"),
      value: formatLoanMoney(summary.loanedInRange),
      description: t("accounting.loans.stats.loanedInRangeDescription"),
      icon: CreditCard,
    },
    {
      label: t("accounting.loans.stats.paidInRange"),
      value: formatLoanMoney(summary.paidInRange),
      description: t("accounting.loans.stats.paidInRangeDescription"),
      icon: ReceiptText,
    },
    {
      label: t("accounting.loans.stats.activeLoans"),
      value: summary.activeLoans.toLocaleString(),
      description: t("accounting.loans.stats.activeLoansDescription"),
      icon: FileText,
    },
  ];

  const tableColumns: DataTableColumn<Loan>[] = useMemo(
    () => [
      {
        id: "employee.name",
        label: t("accounting.loans.columns.employee"),
        renderCell: (loan) => <span className="font-medium">{loan.employee.name}</span>,
      },
      {
        id: "loanAccount.name",
        label: t("accounting.loans.columns.loanAccount"),
        renderCell: (loan) => loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-",
      },
      {
        id: "description",
        label: t("accounting.loans.columns.description"),
        renderCell: (loan) => loan.description || "-",
      },
      {
        id: "openedAt",
        label: t("accounting.loans.columns.opened"),
        renderCell: (loan) => formatLoanDate(loan.openedAt) || "-",
      },
      {
        id: "principalAmount",
        label: t("accounting.loans.columns.principalAmount"),
        renderCell: (loan) => formatLoanMoney(loan.principalAmount),
      },
      {
        id: "paidAmount",
        label: t("accounting.loans.columns.paid"),
        renderCell: (loan) => formatLoanMoney(loan.paidAmount),
      },
      {
        id: "balance",
        label: t("accounting.loans.columns.balance"),
        renderCell: (loan) => <span className="font-semibold">{formatLoanMoney(loan.balance)}</span>,
      },
      {
        id: "status",
        label: t("accounting.loans.columns.status"),
        renderCell: (loan) => (
          <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status, t)}</Badge>
        ),
      },
      {
        id: "lastActivityAt",
        label: t("accounting.loans.columns.lastActivity"),
        renderCell: (loan) => formatLoanDate(loan.lastActivityAt) || "-",
      },
      {
        id: "actions",
        label: t("accounting.loans.columns.actions"),
        stopRowClick: true,
        renderCell: (loan) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("accounting.loans.actions.newLoanPaymentFor", { name: loan.employee.name })}
            onClick={() => openPaymentForLoan(loan)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [t],
  );
  const columnVisibility = useColumnVisibility(LOANS_TABLE_COLUMN_STORAGE_KEY, tableColumns);

  function openPaymentForLoan(loan: Loan | null) {
    setPaymentInitialLoan(loan);
    setPaymentOpen(true);
  }

  async function handleCreateLoan(values: LoanCreateValues) {
    try {
      const loan = await createLoanMutation.mutateAsync(values);
      notifySuccess(
        loan?.employee.name
          ? t("accounting.loans.toasts.createdFor", { name: loan.employee.name })
          : t("accounting.loans.toasts.created"),
      );
      setPage(1);
      setCreateOpen(false);
    } catch (error) {
      notifyError(loanMutationErrorMessage(error, t));
      throw error;
    }
  }

  async function handleRecordPayment(values: LoanPaymentValues) {
    try {
      await recordPaymentMutation.mutateAsync(values);
      notifySuccess(t("accounting.loans.toasts.paymentRecorded"));
      setPaymentOpen(false);
      setPaymentInitialLoan(null);
    } catch (error) {
      notifyError(loanMutationErrorMessage(error, t));
    }
  }

  async function handlePrintSelected() {
    if (selectedIds.length === 0) {
      notifyError(t("accounting.loans.payments.selectLoanToPrint"));
      return;
    }
    const loansForPrint = selectedLoansOnPage.filter((loan) => selectedIds.includes(loan.id));
    if (loansForPrint.length === 0) {
      notifyError(t("accounting.loans.payments.selectLoanToPrint"));
      return;
    }
    const employeeIds = new Set(loansForPrint.map((loan) => loan.employee.id).filter((id) => id > 0));
    if (employeeIds.size !== 1) {
      notifyError(t("accounting.loans.payments.selectSameEmployeeToPrint"));
      return;
    }
    try {
      const report = await generateLoanReportMutation.mutateAsync(
        buildSelectedLoansReportRequest(loansForPrint, "pdf"),
      );
      openLoanReportUrl(report.url);
      notifySuccess(t("accounting.loans.payments.printSuccess"));
    } catch (error) {
      notifyError(normalizeApiError(error).message || t("accounting.loans.payments.printError"));
    }
  }

  async function handleExportExcelSelected() {
    if (selectedIds.length === 0) {
      notifyError(t("accounting.loans.payments.selectLoansToExport"));
      return;
    }
    try {
      const loansForExport = selectedLoansOnPage.filter((loan) => selectedIds.includes(loan.id));
      const report = await generateLoanReportMutation.mutateAsync(
        loansForExport.length > 0
          ? buildSelectedLoansReportRequest(loansForExport, "excel")
          : {
              type: "loan" as const,
              collection: "loans" as const,
              values: selectedIds,
              lookupField: "id",
              format: "excel" as const,
              language: "es" as const,
            },
      );
      await downloadLoanExcelReport(report);
      notifySuccess(t("accounting.loans.payments.excelSuccess"));
    } catch (error) {
      notifyError(normalizeApiError(error).message || t("accounting.loans.payments.excelError"));
    }
  }

  function openPaymentsForSelected() {
    const loan = selectedLoansOnPage[0] ?? (selectedLoan && selectedIds.includes(selectedLoan.id) ? selectedLoan : null);
    if (!loan) {
      notifyError(t("accounting.loans.payments.selectLoanToPrint"));
      return;
    }
    setSelectedLoan(loan);
    setPaymentHistoryLoan(loan);
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageRowIds])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageRowIds.includes(id)));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id),
    );
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  return (
    <div>
      <div className="hidden md:block">
        <PageHeader
          title={t("accounting.loans.page.title")}
          description={t("accounting.loans.page.description")}
          actions={
            <>
              <Button variant="outline" onClick={() => openPaymentForLoan(selectedLoan)}>
                <ReceiptText className="h-4 w-4" />
                {t("accounting.loans.actions.newLoanPayment")}
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("accounting.loans.actions.newLoan")}
              </Button>
            </>
          }
        />

        <StatCards items={stats} />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="gap-0">
            {paymentHistoryLoan ? (
              <LoanPaymentsDesktopPanel
                loan={paymentHistoryLoan}
                payments={paymentTransactions}
                loading={loanTransactionsQuery.isPending}
                error={paymentHistoryError}
                onBack={() => setPaymentHistoryLoan(null)}
                onRecordPayment={openPaymentForLoan}
                labels={paymentLabels}
              />
            ) : (
              <>
            <CardHeader className="gap-3 border-b py-4 pb-3">
              <TableDirectoryToolbar
                filtersOpen={filtersOpen}
                onFiltersOpenChange={setFiltersOpen}
                activeFilterCount={activeFilterCount}
                columnLayout={columnVisibility}
                searchSummary={searchResultHint}
                search={
                  <TableSearchInput
                    value={filters.query}
                    onChange={(query) => {
                      setFilters((current) => ({ ...current, query }));
                      setPage(1);
                    }}
                    placeholder={t("accounting.loans.table.searchPlaceholder")}
                  />
                }
                filterPanel={
                  <TableFilterPanel
                    resultSummary={listSummary}
                    presets={{
                      storageKey: "accounting-loans",
                      rows: filters.rows,
                      fields: LOAN_TABLE_FILTER_FIELDS,
                      onApply: (rows) => {
                        setFilters((current) => ({ ...current, rows }));
                        setPage(1);
                      },
                    }}
                    onClearAll={hasActiveFilters ? resetFilters : undefined}
                  >
                    <TableAdvancedFilterBuilder
                      open={filtersOpen}
                      rows={filters.rows}
                      fields={LOAN_TABLE_FILTER_FIELDS}
                      dynamicOptions={{ loanAccounts: loanAccountFilterOptions }}
                      onChange={(rows) => {
                        setFilters((current) => ({ ...current, rows }));
                        setPage(1);
                      }}
                    />
                  </TableFilterPanel>
                }
              />
            </CardHeader>

            <TableSelectionToolbar
              selectedIds={selectedIds}
              pageRowIds={pageRowIds}
              totalCount={totalLoans}
              onSelectedIdsChange={setSelectedIds}
              onView={openPaymentsForSelected}
              canEdit={false}
              canDelete={false}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintSelected}
                    disabled={generateLoanReportMutation.isPending || selectedIds.length === 0}
                  >
                    <Printer className="h-4 w-4" />
                    {generateLoanReportMutation.isPending
                      ? t("accounting.loans.payments.printPreparing")
                      : t("accounting.loans.payments.print")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcelSelected}
                    disabled={generateLoanReportMutation.isPending || selectedIds.length === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {generateLoanReportMutation.isPending
                      ? t("accounting.loans.payments.excelPreparing")
                      : t("accounting.loans.payments.excel")}
                  </Button>
                </>
              }
            />

            {loansQuery.isError ? (
              <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
                {loansQuery.error instanceof Error ? loansQuery.error.message : t("accounting.loans.table.loadError")}
              </div>
            ) : null}

            {loansQuery.isPending && loans.length === 0 ? (
              <DirectoryTableLoader
                icon={Banknote}
                title={t("accounting.loans.table.loadingTitle")}
                description={t("accounting.loans.table.loadingDescription")}
                columns={[
                  t("accounting.loans.columns.employee"),
                  t("accounting.loans.columns.loanAccount"),
                  t("accounting.loans.columns.balance"),
                  t("accounting.loans.columns.status"),
                ]}
              />
            ) : (
              <DataTable
                columns={columnVisibility.columns}
                rows={loans}
                page={page}
                isPageDataPending={loansQuery.isFetching}
                rowKey={(loan) => loan.id}
                rowLabel={(loan) => loan.employee.name}
                columnLayout={columnVisibility}
                minWidth={1320}
                sort={sort}
                onSortChange={onSortChange}
                selectable
                selectedIds={selectedIds}
                allPageSelected={allPageSelected}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelect={toggleSelect}
                onRowClick={(loan) => {
                  setSelectedLoan(loan);
                  setPaymentHistoryLoan((current) => (current ? loan : current));
                }}
                activeRowId={selectedLoan?.id}
                emptyState={
                  <div className="py-10 text-center">
                    <p className="text-muted-foreground">{t("accounting.loans.table.empty")}</p>
                    <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      {t("accounting.loans.actions.newLoan")}
                    </Button>
                  </div>
                }
              />
            )}

            <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{listSummary}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                  {t("common.actions.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("common.pagination.pageOf", { current: page, total: totalPages })}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  {t("common.actions.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
              </>
            )}
          </Card>

          <Card className="h-fit gap-0">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{t("accounting.loans.details.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("accounting.loans.details.subtitle")}</p>
                </div>
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-4">
              {selectedLoan ? (
                <>
                  <div>
                    <p className="text-lg font-semibold">{selectedLoan.employee.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedLoan.description || t("accounting.loans.fallbackDescription")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.loans.details.principal")}</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.principalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.loans.details.paid")}</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.loans.details.balance")}</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.balance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("accounting.loans.details.status")}</p>
                      <Badge className={loanStatusClassName(selectedLoan.status)}>{loanStatusLabel(selectedLoan.status, t)}</Badge>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => openPaymentForLoan(selectedLoan)} disabled={selectedLoan.status !== "ACTIVE"}>
                    <ReceiptText className="h-4 w-4" />
                    {t("accounting.loans.actions.newLoanPayment")}
                  </Button>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{paymentLabels.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("accounting.loans.details.paidAmount", { amount: formatLoanMoney(selectedLoan.paidAmount) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLoan.paidAmount > 0 ? (
                          <Badge variant="outline">{paymentTransactions.length}</Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedIds([selectedLoan.id]);
                            setPaymentHistoryLoan(selectedLoan);
                          }}
                          aria-label={t("accounting.loans.payments.viewAria", { name: selectedLoan.employee.name })}
                        >
                          {paymentLabels.view}
                        </Button>
                      </div>
                    </div>

                    {selectedLoan.paidAmount <= 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">{paymentLabels.noneRecorded}</p>
                    ) : (
                      <LoanPaymentEntries
                        payments={paymentTransactions}
                        loading={loanTransactionsQuery.isPending}
                        error={paymentHistoryError}
                        emptyMessage={paymentLabels.empty}
                        loadingMessage={paymentLabels.loading}
                        refLabel={paymentLabels.refLabel}
                        createdByTemplate={paymentLabels.createdBy}
                        compact
                      />
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("accounting.loans.details.empty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-5 md:hidden">
        <div className="rounded-b-3xl bg-primary px-4 pb-6 pt-5 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-normal">{t("accounting.loans.page.title")}</h1>
              <p className="mt-1 text-sm text-primary-foreground/80">{t("accounting.loans.page.mobileSubtitle")}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                onClick={handlePrintSelected}
                disabled={selectedIds.length === 0 || generateLoanReportMutation.isPending}
                aria-label={t("accounting.loans.payments.print")}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setCreateOpen(true)} aria-label={t("accounting.loans.actions.newLoan")}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {paymentHistoryLoan ? (
          <LoanPaymentsMobileView
            loan={paymentHistoryLoan}
            payments={paymentTransactions}
            loading={loanTransactionsQuery.isPending}
            error={paymentHistoryError}
            onBack={() => setPaymentHistoryLoan(null)}
            onRecordPayment={openPaymentForLoan}
            labels={paymentLabels}
          />
        ) : (
          <>
            <div className="px-4">
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder={t("accounting.loans.table.searchPlaceholder")}
                inputClassName="h-12 rounded-2xl border-border bg-background text-base text-foreground shadow-none"
              />
              <div className="mt-3">
                <TableDirectoryToolbar
                  search={<div />}
                  filtersOpen={filtersOpen}
                  onFiltersOpenChange={setFiltersOpen}
                  activeFilterCount={activeFilterCount}
                  filterPanel={
                    <TableFilterPanel resultSummary={listSummary} onClearAll={hasActiveFilters ? resetFilters : undefined}>
                      <TableAdvancedFilterBuilder
                        open={filtersOpen}
                        rows={filters.rows}
                        fields={LOAN_TABLE_FILTER_FIELDS}
                        dynamicOptions={{ loanAccounts: loanAccountFilterOptions }}
                        onChange={(rows) => {
                          setFilters((current) => ({ ...current, rows }));
                          setPage(1);
                        }}
                      />
                    </TableFilterPanel>
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-4">
              <Button variant="outline" className="h-11 rounded-xl" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="h-4 w-4" />
                {t("common.actions.previous")}
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {t("common.pagination.pageOf", { current: page, total: totalPages })}
              </span>
              <Button variant="outline" className="h-11 rounded-xl" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 px-4 pb-8">
              {loansQuery.isPending && loans.length === 0 ? (
                <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{t("accounting.loans.table.loading")}</div>
              ) : loans.length === 0 ? (
                <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{t("accounting.loans.table.empty")}</div>
              ) : (
                loans.map((loan) => (
                  <LoanMobileCard
                    key={loan.id}
                    loan={loan}
                    selected={selectedLoan?.id === loan.id}
                    onSelect={setSelectedLoan}
                    onRecordPayment={openPaymentForLoan}
                    onViewPayments={setPaymentHistoryLoan}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <CreateLoanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        loanAccounts={loanAccounts}
        assetAccounts={assetAccounts}
        pending={createLoanMutation.isPending}
        onSubmit={handleCreateLoan}
      />
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) setPaymentInitialLoan(null);
        }}
        employees={employees}
        loans={loans}
        assetAccounts={assetAccounts}
        pending={recordPaymentMutation.isPending}
        initialLoan={paymentInitialLoan}
        onSubmit={handleRecordPayment}
      />
    </div>
  );
}
