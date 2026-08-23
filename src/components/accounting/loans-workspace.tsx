"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
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
import { useCreateLoan, useLoans, useRecordLoanPayment } from "@/lib/accounting/loans/hooks";
import { buildLoanReportFilters } from "@/lib/accounting/loans/api";
import {
  formatLoanDate,
  formatLoanMoney,
  loanStatusLabel,
} from "@/lib/accounting/loans/display";
import { LOAN_TABLE_FILTER_FIELDS } from "@/lib/accounting/loans/filter-fields";
import { createLoanSchema, loanPaymentSchema } from "@/lib/accounting/loans/schemas";
import {
  DEFAULT_LOAN_LIST_PARAMS,
  EMPTY_LOAN_SUMMARY,
  type Loan,
  type LoanCreateValues,
  type LoanPaymentValues,
} from "@/lib/accounting/loans/types";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useGenerateLoanReport } from "@/lib/reports/hooks/use-reports";
import { openLoanReportUrl } from "@/lib/accounting/loans/print-loan-report";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const LOANS_TABLE_COLUMN_STORAGE_KEY = "accounting-loans-v1";

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
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-semibold">Journal preview</p>
      <div className="mt-3 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="font-semibold">Debit</p>
            <p className="text-muted-foreground">{debitAccount || "Select account"}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatLoanMoney(amount)}</p>
        </div>
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="font-semibold">Credit</p>
            <p className="text-muted-foreground">{creditAccount || "Select account"}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatLoanMoney(amount)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-medium text-muted-foreground">Transaction type</p>
            <p className="mt-1 font-semibold">LOAN</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Loan transaction</p>
            <p className="mt-1 font-semibold">{transactionLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateLoanDialog({
  open,
  onOpenChange,
  employees,
  loanAccounts,
  assetAccounts,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: number; name: string }>;
  loanAccounts: Array<{ id: number; name: string; displayName: string; type?: string }>;
  assetAccounts: Array<{ id: number; name: string; displayName: string; type?: string }>;
  onSubmit: (values: LoanCreateValues) => Promise<void>;
  pending: boolean;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<LoanCreateValues>({
    resolver: zodResolver(createLoanSchema),
    defaultValues: {
      employeeId: 0,
      loanAccountId: 0,
      sourceAccountId: 0,
      principalAmount: 0,
      transactionDate: todayInputValue(),
      referenceNumber: "",
      description: "",
    },
  });
  const amount = watch("principalAmount") ?? 0;
  const loanAccountName = watch("loanAccountName") ?? "";
  const sourceAccountName = watch("sourceAccountName") ?? "";

  function closeDialog(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset({
        transactionDate: todayInputValue(),
        employeeId: 0,
        loanAccountId: 0,
        sourceAccountId: 0,
        principalAmount: 0,
        referenceNumber: "",
        description: "",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Create loan</DialogTitle>
          <DialogDescription>
            Record a new employee loan and post its journal entry.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-loan-form"
          className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>Employee</RequiredLabel>
              <SearchableSelect
                value={watch("employeeId") ? String(watch("employeeId")) : ""}
                onValueChange={(next) => {
                  const employee = employees.find((item) => item.id === Number(next));
                  setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                  setValue("employeeName", employee?.name ?? "");
                }}
                options={employees.map((employee) => ({
                  value: String(employee.id),
                  label: employee.name,
                  keywords: [employee.name],
                }))}
                placeholder="Select employee"
                searchPlaceholder="Search employees"
                mobileSheet
              />
              {errors.employeeId ? <p className="text-sm text-destructive">{errors.employeeId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel>Loan account</RequiredLabel>
              <SearchableSelect
                value={watch("loanAccountId") ? String(watch("loanAccountId")) : ""}
                onValueChange={(next) => {
                  const account = loanAccounts.find((item) => item.id === Number(next));
                  setValue("loanAccountId", account?.id ?? 0, { shouldValidate: true });
                  setValue("loanAccountName", account ? accountLabel(account) : "");
                  setValue("loanAccountType", account?.type);
                }}
                options={loanAccounts.map((account) => ({
                  value: String(account.id),
                  label: accountLabel(account),
                  keywords: [account.name, account.displayName],
                }))}
                placeholder="Select loan account"
                searchPlaceholder="Search loan accounts"
                mobileSheet
              />
              {errors.loanAccountId ? <p className="text-sm text-destructive">{errors.loanAccountId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel>Source asset account</RequiredLabel>
              <SearchableSelect
                value={watch("sourceAccountId") ? String(watch("sourceAccountId")) : ""}
                onValueChange={(next) => {
                  const account = assetAccounts.find((item) => item.id === Number(next));
                  setValue("sourceAccountId", account?.id ?? 0, { shouldValidate: true });
                  setValue("sourceAccountName", account ? accountLabel(account) : "");
                  setValue("sourceAccountType", account?.type);
                }}
                options={assetAccounts.map((account) => ({
                  value: String(account.id),
                  label: accountLabel(account),
                  keywords: [account.name, account.displayName],
                }))}
                placeholder="Select source asset account"
                searchPlaceholder="Search asset accounts"
                mobileSheet
              />
              {errors.sourceAccountId ? <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-principal">Principal amount</RequiredLabel>
              <Input
                id="loan-principal"
                type="number"
                min="0.01"
                step="0.01"
                {...register("principalAmount", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
              {errors.principalAmount ? <p className="text-sm text-destructive">{errors.principalAmount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-date">Date</RequiredLabel>
              <DateInput id="loan-date" {...register("transactionDate")} />
              {errors.transactionDate ? <p className="text-sm text-destructive">{errors.transactionDate.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="loan-reference">Reference number</Label>
              <Input id="loan-reference" placeholder="Optional" {...register("referenceNumber")} />
              {errors.referenceNumber ? <p className="text-sm text-destructive">{errors.referenceNumber.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="loan-description">Description</Label>
              <textarea
                id="loan-description"
                rows={4}
                className="flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="Loan reason or notes"
                {...register("description")}
              />
              {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
            </div>
          </div>
          <LoanJournalPreview
            debitAccount={loanAccountName}
            creditAccount={sourceAccountName}
            amount={amount}
            transactionLabel="ISSUE"
          />
        </form>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-loan-form" disabled={pending}>
            Create loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  assetAccounts: Array<{ id: number; name: string; displayName: string; type?: string }>;
  onSubmit: (values: LoanPaymentValues) => Promise<void>;
  pending: boolean;
  initialLoan: Loan | null;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<LoanPaymentValues>({
    resolver: zodResolver(loanPaymentSchema),
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
      ? `${formatLoanMoney(Math.min(amount, selectedLoan.balance))} to ${selectedLoan.description || selectedLoan.id}`
      : buildOldestFirstAllocationPreview(employeeLoans, amount);

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
          <DialogTitle>Record loan payment</DialogTitle>
          <DialogDescription>
            Apply a payment to an employee loan and post its journal entry.
          </DialogDescription>
        </DialogHeader>
        <form
          id="loan-payment-form"
          className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>Employee</RequiredLabel>
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
                placeholder="Select employee"
                searchPlaceholder="Search employees"
                mobileSheet
              />
              {errors.employeeId ? <p className="text-sm text-destructive">{errors.employeeId.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>Allocation mode</RequiredLabel>
              <div className="grid grid-cols-2 rounded-lg border bg-muted/20 p-1">
                {[
                  { value: "oldest-first", label: "Oldest first" },
                  { value: "specific-loan", label: "Specific loan" },
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
                <RequiredLabel>Loan</RequiredLabel>
                <SearchableSelect
                  value={selectedLoanId ?? ""}
                  onValueChange={(next) => setValue("loanId", next, { shouldValidate: true })}
                  options={employeeLoans.map((loan) => ({
                    value: loan.id,
                    label: `${loan.employee.name} - ${loan.description || loan.id}`,
                    description: `Balance ${formatLoanMoney(loan.balance)}`,
                    keywords: [loan.employee.name, loan.description, loan.referenceNumber],
                  }))}
                  placeholder="Select loan"
                  searchPlaceholder="Search loans"
                  mobileSheet
                />
                {errors.loanId ? <p className="text-sm text-destructive">{errors.loanId.message}</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel>Payment received account</RequiredLabel>
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
                placeholder="Select received account"
                searchPlaceholder="Search asset accounts"
                mobileSheet
              />
              {errors.receivedAccountId ? <p className="text-sm text-destructive">{errors.receivedAccountId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-payment-amount">Payment amount</RequiredLabel>
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
                Payment allocation: {allocationPreview}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel htmlFor="loan-payment-date">Date</RequiredLabel>
              <DateInput id="loan-payment-date" {...register("transactionDate")} />
              {errors.transactionDate ? <p className="text-sm text-destructive">{errors.transactionDate.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan-payment-reference">Reference number</Label>
              <Input id="loan-payment-reference" placeholder="Optional" {...register("referenceNumber")} />
              {errors.referenceNumber ? <p className="text-sm text-destructive">{errors.referenceNumber.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="loan-payment-description">Description</Label>
              <textarea
                id="loan-payment-description"
                rows={4}
                className="flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="Payment notes"
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
            Cancel
          </Button>
          <Button type="submit" form="loan-payment-form" disabled={pending}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildOldestFirstAllocationPreview(loans: Loan[], amount: number) {
  if (amount <= 0 || loans.length === 0) return "";
  let remaining = amount;
  const parts: string[] = [];
  for (const loan of [...loans].sort((left, right) => left.openedAt.localeCompare(right.openedAt))) {
    if (remaining <= 0) break;
    const applied = Math.min(loan.balance, remaining);
    if (applied > 0) {
      parts.push(`${formatLoanMoney(applied)} to ${loan.description || loan.id}`);
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
}: {
  loan: Loan;
  selected: boolean;
  onSelect: (loan: Loan) => void;
  onRecordPayment: (loan: Loan) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors",
        selected && "border-primary bg-primary/5",
      )}
      onClick={() => onSelect(loan)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{loan.employee.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{loan.description || "Loan"}</p>
        </div>
        <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="font-semibold">{formatLoanMoney(loan.balance)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Principal</p>
          <p className="font-semibold">{formatLoanMoney(loan.principalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Loan account</p>
          <p className="truncate font-medium">{loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last activity</p>
          <p className="font-medium">{formatLoanDate(loan.lastActivityAt) || "-"}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <span
          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onRecordPayment(loan);
          }}
        >
          Record payment
        </span>
      </div>
    </button>
  );
}

export function LoansWorkspace() {
  const { notifySuccess, notifyError } = useFeedback();
  const [filters, setFilters] = useState<LoanFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInitialLoan, setPaymentInitialLoan] = useState<Loan | null>(null);
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
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500, sort: "displayName:asc" });
  const createLoanMutation = useCreateLoan();
  const recordPaymentMutation = useRecordLoanPayment();
  const generateLoanReportMutation = useGenerateLoanReport();
  const loans = loansQuery.data?.items ?? [];
  const summary = loansQuery.data?.summary ?? EMPTY_LOAN_SUMMARY;
  const totalLoans = loansQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLoans / PAGE_SIZE));
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
  const listSummary = formatPaginatedListSummary({
    itemCountOnPage: loans.length,
    page,
    pageSize: PAGE_SIZE,
    total: totalLoans,
    noun: "loans",
    isLoading: loansQuery.isFetching,
  });
  const searchResultHint = hasActiveFilters ? listSummary : undefined;
  const stats = [
    {
      label: "Outstanding balance",
      value: formatLoanMoney(summary.outstandingBalance),
      description: "Calculated loan balance",
      icon: Banknote,
    },
    {
      label: "Loaned in range",
      value: formatLoanMoney(summary.loanedInRange),
      description: "Principal issued",
      icon: CreditCard,
    },
    {
      label: "Paid in range",
      value: formatLoanMoney(summary.paidInRange),
      description: "Payments received",
      icon: ReceiptText,
    },
    {
      label: "Active loans",
      value: summary.activeLoans.toLocaleString(),
      description: "Open employee loans",
      icon: FileText,
    },
  ];

  const tableColumns: DataTableColumn<Loan>[] = useMemo(
    () => [
      {
        id: "employee.name",
        label: "Employee",
        renderCell: (loan) => <span className="font-medium">{loan.employee.name}</span>,
      },
      {
        id: "loanAccount.displayName",
        label: "Loan account",
        renderCell: (loan) => loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-",
      },
      {
        id: "description",
        label: "Description",
        renderCell: (loan) => loan.description || "-",
      },
      {
        id: "openedAt",
        label: "Opened",
        renderCell: (loan) => formatLoanDate(loan.openedAt) || "-",
      },
      {
        id: "principalAmount",
        label: "Principal amount",
        renderCell: (loan) => formatLoanMoney(loan.principalAmount),
      },
      {
        id: "paidAmount",
        label: "Paid",
        renderCell: (loan) => formatLoanMoney(loan.paidAmount),
      },
      {
        id: "balance",
        label: "Balance",
        renderCell: (loan) => <span className="font-semibold">{formatLoanMoney(loan.balance)}</span>,
      },
      {
        id: "status",
        label: "Status",
        renderCell: (loan) => (
          <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
        ),
      },
      {
        id: "lastActivityAt",
        label: "Last activity",
        renderCell: (loan) => formatLoanDate(loan.lastActivityAt) || "-",
      },
      {
        id: "actions",
        label: "Actions",
        stopRowClick: true,
        renderCell: (loan) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Record payment for ${loan.employee.name}`}
            onClick={() => openPaymentForLoan(loan)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [],
  );
  const columnVisibility = useColumnVisibility(LOANS_TABLE_COLUMN_STORAGE_KEY, tableColumns);

  function openPaymentForLoan(loan: Loan | null) {
    setPaymentInitialLoan(loan);
    setPaymentOpen(true);
  }

  async function handleCreateLoan(values: LoanCreateValues) {
    try {
      const loan = await createLoanMutation.mutateAsync(values);
      notifySuccess(`Loan created${loan?.employee.name ? ` for ${loan.employee.name}` : ""}.`);
      setCreateOpen(false);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to create loan.");
    }
  }

  async function handleRecordPayment(values: LoanPaymentValues) {
    try {
      await recordPaymentMutation.mutateAsync(values);
      notifySuccess("Loan payment recorded.");
      setPaymentOpen(false);
      setPaymentInitialLoan(null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to record loan payment.");
    }
  }

  async function handlePrintReport() {
    try {
      const report = await generateLoanReportMutation.mutateAsync({
        type: "loan",
        collection: "loans",
        filters: buildLoanReportFilters(listParams),
        operator: "and",
      });
      openLoanReportUrl(report.url);
      notifySuccess("Loan report generated.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to generate loan report.");
    }
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  return (
    <div>
      <div className="hidden md:block">
        <PageHeader
          title="Loans"
          description="Track employee loan balances, payments, and journal activity."
          actions={
            <>
              <Button variant="outline" onClick={handlePrintReport} disabled={generateLoanReportMutation.isPending}>
                <Printer className="h-4 w-4" />
                Print report
              </Button>
              <Button variant="outline" onClick={() => openPaymentForLoan(selectedLoan)}>
                <ReceiptText className="h-4 w-4" />
                Record payment
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New loan
              </Button>
            </>
          }
        />

        <StatCards items={stats} />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="gap-0">
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
                    placeholder="Search employee, loan, reference"
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

            {loansQuery.isError ? (
              <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
                {loansQuery.error instanceof Error ? loansQuery.error.message : "Unable to load loans."}
              </div>
            ) : null}

            {loansQuery.isPending && loans.length === 0 ? (
              <DirectoryTableLoader
                icon={Banknote}
                title="Loading loans"
                description="Preparing employee loan balances."
                columns={["Employee", "Loan account", "Balance", "Status"]}
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
                onRowClick={setSelectedLoan}
                activeRowId={selectedLoan?.id}
                emptyState={
                  <div className="py-10 text-center">
                    <p className="text-muted-foreground">No loans match the current filters.</p>
                    <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      New loan
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
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="h-fit gap-0">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">Selected loan</p>
                  <p className="text-sm text-muted-foreground">Balance and recent activity</p>
                </div>
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-4">
              {selectedLoan ? (
                <>
                  <div>
                    <p className="text-lg font-semibold">{selectedLoan.employee.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedLoan.description || "Loan"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.principalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-semibold">{formatLoanMoney(selectedLoan.balance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className={loanStatusClassName(selectedLoan.status)}>{loanStatusLabel(selectedLoan.status)}</Badge>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => openPaymentForLoan(selectedLoan)} disabled={selectedLoan.status !== "ACTIVE"}>
                    <ReceiptText className="h-4 w-4" />
                    Record payment
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a loan to view balance details.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-5 md:hidden">
        <div className="rounded-b-3xl bg-primary px-4 pb-6 pt-5 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-normal">Loans</h1>
              <p className="mt-1 text-sm text-primary-foreground/80">Employee balances and payments</p>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" onClick={handlePrintReport} disabled={generateLoanReportMutation.isPending} aria-label="Print report">
                <Printer className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setCreateOpen(true)} aria-label="New loan">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4">
          <TableSearchInput
            value={filters.query}
            onChange={(query) => {
              setFilters((current) => ({ ...current, query }));
              setPage(1);
            }}
            placeholder="Search employee, loan, reference"
            inputClassName="h-12 rounded-2xl border-0 bg-blue-50 text-base shadow-none"
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
            Previous
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" className="h-11 rounded-xl" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 px-4 pb-8">
          {loansQuery.isPending && loans.length === 0 ? (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Loading loans...</div>
          ) : loans.length === 0 ? (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No loans match the current filters.</div>
          ) : (
            loans.map((loan) => (
              <LoanMobileCard
                key={loan.id}
                loan={loan}
                selected={selectedLoan?.id === loan.id}
                onSelect={setSelectedLoan}
                onRecordPayment={openPaymentForLoan}
              />
            ))
          )}
        </div>
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
