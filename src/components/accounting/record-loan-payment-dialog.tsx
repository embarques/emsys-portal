"use client";

import { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Banknote, Landmark, ReceiptText, User } from "lucide-react";
import { TransactionSectionNavigation } from "@/components/accounting/transaction-section-navigation";
import { useScrollFocusedSectionToTop } from "@/hooks/use-scroll-focused-section-to-top";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { JournalSummaryLine } from "@/components/accounting/loan-journal-summary-line";
import { LoanEmployeeField } from "@/components/accounting/loan-employee-field";
import { LoanQuickLoanButtons } from "@/components/accounting/loan-quick-loan-buttons";
import { CurrentTransactionSummary } from "@/components/accounting/transaction-review";
import { FieldLabelRow } from "@/components/forms/field-label-row";
import { DateInput } from "@/components/ui/date-input";
import {
  CompactActionDialogContent,
  CompactActionDialogHeader,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useEmployeeActiveLoans } from "@/lib/accounting/loans/hooks";
import { formatLoanDate, formatLoanMoney } from "@/lib/accounting/loans/display";
import { allocateLoanPayment, sortLoansOldestFirst, type LoanPaymentAllocation } from "@/lib/accounting/loans/payment-allocation";
import { createLoanPaymentSchema } from "@/lib/accounting/loans/schemas";
import type { Loan, LoanPaymentValues } from "@/lib/accounting/loans/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { formatFormMutationError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import { useLoanEntrySteps } from "@/lib/accounting/loans/use-loan-entry-steps";
import { LoanEntryStepFooter, LoanEntryStepHeading, LoanEntryStepNavigation } from "@/components/accounting/loan-entry-step-navigation";
import type { GuidedTypeStep } from "@/components/accounting/guided-entry-chrome";
import { Button } from "@/components/ui/button";
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
  /** When set without initialLoan, opens payment with this employee preselected. */
  initialEmployee?: { id: number; name: string } | null;
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
      <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-4xl")}>
        <CompactActionDialogHeader
          icon={Banknote}
          title={t("accounting.loans.paymentForm.title")}
          description={t("accounting.loans.paymentForm.description")}
        />
        {props.open ? <RecordLoanPaymentForm {...props} /> : null}
      </CompactActionDialogContent>
    </Dialog>
  );
}

export function RecordLoanPaymentForm({ employees, loans, assetAccounts, initialLoan, initialEmployee = null, pending, onSubmit, onOpenChange, summaryContainer, guided = false, typeStep }: Props & { summaryContainer?: HTMLElement | null; guided?: boolean; typeStep?: GuidedTypeStep }) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.loans.paymentForm.${key}`, values);
  const handleEnterNavigation = useFormEnterNavigation();
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const maxOutstandingRef = useRef<number | undefined>(undefined);
  useScrollFocusedSectionToTop(formRef);
  const form = useForm<LoanPaymentValues>({
    resolver: async (values, context, options) =>
      zodResolver(createLoanPaymentSchema(t, maxOutstandingRef.current))(values, context, options),
    defaultValues: {
      loanId: initialLoan?.id ?? "",
      employeeId: initialLoan?.employee.id ?? initialEmployee?.id ?? 0,
      employeeName: initialLoan?.employee.name ?? initialEmployee?.name,
      receivedAccountId: 0,
      amount: 0,
      transactionDate: todayInputValue(),
      referenceNumber: "",
      description: "",
    },
  });
  const { register, setValue, watch, formState: { errors } } = form;
  const busy = pending || form.formState.isSubmitting;
  const flow = useLoanEntrySteps(form, ["employeeId", "loanId"], guided);
  const stageClass = (stage: number) => guided && flow.step !== stage ? "hidden" : undefined;
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
  const allocationLoans = selectedLoan ? [selectedLoan] : [];
  const allocation = allocateLoanPayment(allocationLoans, amount);
  const previewReady = allocationLoans.length > 0 && !employeeLoansQuery.isError;
  maxOutstandingRef.current = previewReady ? allocation.totals.balance : undefined;
  const creditAccountName = accountLabel(selectedLoan?.loanAccount);
  const noActiveLoans = selectedEmployeeId > 0 && employeeLoansQuery.isSuccess && employeeLoans.length === 0;
  const loanPlaceholder = selectedEmployeeId ? text("selectLoan") : text("selectEmployeeFirst");

  const inlineOptionsLimit = guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined;
  const loanOptions = loanOptionsSource.map((loan) => ({
    value: loan.id,
    label: `${loan.employee.name} - ${loan.description || t("accounting.loans.fallbackDescription")}`,
    keywords: [loan.employee.name, loan.description, loan.referenceNumber],
  }));
  const loanInline = getInlineSelectOptions({ inlineOptionsLimit, options: loanOptions, value: selectedLoanId || "", placeholder: loanPlaceholder }) !== null;

  const receivedAccountOptions = assetAccounts.map((account) => ({
    value: String(account.id),
    label: accountLabel(account),
    keywords: [account.name, account.displayName ?? ""],
  }));
  const receivedAccountInline = getInlineSelectOptions({ inlineOptionsLimit, options: receivedAccountOptions, value: receivedAccountId ? String(receivedAccountId) : "", placeholder: text("selectReceivedAccount") }) !== null;

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
      form.setError("root.server", { message: formatFormMutationError(error, t) });
    } finally {
      submitting.current = false;
    }
  });

  return (
    <form ref={formRef} className="flex min-h-0 flex-1 flex-col" noValidate onKeyDown={handleEnterNavigation} onSubmit={(event) => flow.advance(event, submit)}>
      {guided ? <LoanEntryStepNavigation kind="payment" step={flow.step} onStepChange={flow.setStep} busy={busy} typeStep={typeStep} /> : <TransactionSectionNavigation formRef={formRef} title={text("title")} />}
      <FormBody workflow className={guided ? "lg:p-8" : undefined} isBusy={busy}>
        {guided ? <LoanEntryStepHeading kind="payment" step={flow.step} appearance={typeStep?.appearance} /> : null}
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <FormSection
            className={stageClass(1)}
            variant="card"
            icon={User}
            title={text("sections.employee")}
            description={text("loanHint")}
          >
            <div className="flex flex-col gap-4">
              <LoanEmployeeField
                id="loan-payment-employee"
                label={text("employee")}
                employees={employees}
                value={selectedEmployeeId || undefined}
                valueName={watch("employeeName")}
                error={errors.employeeId?.message}
                guided={guided}
                placeholder={text("selectEmployee")}
                searchPlaceholder={text("searchEmployees")}
                onChange={(employee) => {
                  setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                  setValue("employeeName", employee?.name ?? "");
                  setValue("loanId", "", { shouldValidate: true });
                }}
              />
              <div className="space-y-2">
                <FieldLabelRow
                  showClear={Boolean(selectedLoanId) && loanInline}
                  onClear={() => {
                    setValue("loanId", "", { shouldValidate: true });
                    window.requestAnimationFrame(() => document.getElementById("loan-payment-loan")?.focus());
                  }}
                >
                  {requiredLabel("loan-payment-loan", text("loan"))}
                </FieldLabelRow>
                <SearchableSelect
                  inlineOptionsLimit={inlineOptionsLimit}
                  clearable={false}
                  id="loan-payment-loan"
                  aria-label={text("loan")}
                  aria-invalid={Boolean(errors.loanId)}
                  value={selectedLoanId || ""}
                  onValueChange={(next) => {
                    const loan = loanOptionsSource.find((item) => item.id === next);
                    setValue("loanId", loan?.id ?? "", { shouldValidate: true });
                    if (loan) {
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
                  placeholder={loanPlaceholder}
                  searchPlaceholder={text("searchLoans")}
                  emptyMessage={text("balances.empty")}
                  loading={selectedEmployeeId > 0 && employeeLoansQuery.isPending}
                  disabled={!selectedEmployeeId}
                  mobileSheet
                />
                {selectedEmployeeId > 0 && employeeLoans.length > 0 ? (
                  <LoanQuickLoanButtons
                    loans={employeeLoans}
                    disabled={busy}
                    onSelect={(loan) => {
                      setValue("loanId", loan.id, { shouldValidate: true });
                      setValue("employeeId", loan.employee.id, { shouldValidate: true });
                      setValue("employeeName", loan.employee.name);
                    }}
                  />
                ) : null}
                {fieldError("loanId")}
              </div>
            </div>
          </FormSection>

          <FormSection className={guided && flow.step === 1 ? "hidden" : undefined} variant="card" icon={Landmark} title={text("sections.balances")}>
            <LoanBalancesSummary
              allocation={allocation}
              amount={amount}
              employeeSelected={selectedEmployeeId > 0}
              loanSelected={Boolean(selectedLoan)}
              loading={selectedEmployeeId > 0 && employeeLoansQuery.isPending && allocationLoans.length === 0}
              error={employeeLoansQuery.isError}
            />
          </FormSection>

          <FormSection variant="card" className={cn("p-4 [&_label]:min-h-0 [&_label]:text-xs [&_label]:font-medium [&_label]:leading-4 [&_label]:text-muted-foreground", stageClass(2))} icon={ReceiptText} title={text("sections.payment")}>
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <FieldLabelRow
                  showClear={Boolean(receivedAccountId) && receivedAccountInline}
                  onClear={() => {
                    setValue("receivedAccountId", 0, { shouldValidate: true });
                    setValue("receivedAccountName", undefined);
                    setValue("receivedAccountType", undefined);
                    window.requestAnimationFrame(() => document.getElementById("loan-payment-received-account")?.focus());
                  }}
                >
                  {requiredLabel("loan-payment-received-account", text("receivedAccount"))}
                </FieldLabelRow>
                <SearchableSelect
                  inlineOptionsLimit={inlineOptionsLimit}
                  clearable={false}
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
                  options={receivedAccountOptions}
                  placeholder={text("selectReceivedAccount")}
                  searchPlaceholder={text("searchAssetAccounts")}
                  mobileSheet
                />
                {fieldError("receivedAccountId")}
              </div>
              <div className="space-y-2">
                <FieldLabelRow>
                  {requiredLabel("loan-payment-date", text("date"))}
                </FieldLabelRow>
                <DateInput
                  id="loan-payment-date"
                  aria-invalid={Boolean(errors.transactionDate)}
                  className="h-10 min-h-10 rounded-lg border-2 border-foreground/60 shadow-none max-md:min-h-12 max-md:rounded-xl max-md:border max-md:border-input max-md:shadow-xs"
                  {...register("transactionDate")}
                />
                {fieldError("transactionDate")}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-3 items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/35 p-3 sm:gap-x-4">
              <dl className="contents">
                <dt className="col-start-1 row-start-1 self-start text-xs font-medium leading-4 text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.previousBalance")}</dt>
                <dd id="loan-payment-previous-balance" className="col-start-1 row-start-2 min-w-0 break-words text-lg font-semibold text-orange-700 tabular-nums md:text-2xl dark:text-orange-400">
                  {previewReady ? formatLoanMoney(allocation.totals.balance) : t("common.empty.dash")}
                </dd>
                <dt className="col-start-3 row-start-1 self-start text-right text-xs font-medium leading-4 text-muted-foreground">{t("accounting.dailyIncome.form.invoiceSummary.newBalance")}</dt>
                <dd id="loan-payment-new-balance" className="col-start-3 row-start-2 min-w-0 break-words text-right text-lg font-semibold text-emerald-700 tabular-nums md:text-2xl dark:text-emerald-400">
                  {previewReady ? formatLoanMoney(allocation.totals.balanceAfter) : t("common.empty.dash")}
                </dd>
              </dl>
              <div className="col-start-2 row-start-1 min-w-0 self-start text-center [&>label]:block">
                {requiredLabel("loan-payment-amount", t("accounting.dailyIncome.form.fields.paymentAmount"))}
              </div>
              <Input
                id="loan-payment-amount"
                type="number"
                min="0.01"
                max={previewReady ? allocation.totals.balance : undefined}
                step="0.01"
                aria-invalid={Boolean(errors.amount)}
                className="col-start-2 row-start-2 h-10 text-center text-lg font-semibold tabular-nums md:text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                {...register("amount", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
              />
              {previewReady && allocation.totals.balance > 0 ? <div className="col-span-3 flex justify-center pt-2"><Button type="button" size="sm" variant="outline" onClick={() => setValue("amount", allocation.totals.balance, { shouldDirty: true, shouldValidate: true })}>{t("accounting.dailyIncome.wizard.quickFlow.fullBalance", { amount: formatLoanMoney(allocation.totals.balance) })}</Button></div> : null}
              {errors.amount ? <div className="col-start-2 row-start-3 text-center">{fieldError("amount")}</div> : null}
            </div>
          </FormSection>

          <FormSection className={stageClass(2)} variant="card" title={text("sections.notes")}>
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

          {summaryContainer && (!guided || flow.step !== 3) ? null : (
            <FormSection variant="card" icon={Banknote} title={text("sections.journal")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <JournalLine label={text("journalDebit")} account={receivedAccountName} amount={amount} />
                <JournalLine label={text("journalCredit")} account={creditAccountName} amount={amount} />
              </div>
            </FormSection>
          )}
          {guided && flow.step === 3 ? <FormSection variant="card" title={t("accounting.dailyIncome.wizard.quickFlow.review")} action={<Button type="button" variant="ghost" onClick={() => flow.setStep(2)}>{t("common.actions.edit")}</Button>}>
            <dl className="grid gap-4 sm:grid-cols-2">{[
              [text("employee"), watch("employeeName")],
              [text("loan"), selectedLoan?.description || t("accounting.loans.fallbackDescription")],
              [text("receivedAccount"), receivedAccountName], [text("amount"), formatLoanMoney(amount)],
              [text("date"), watch("transactionDate")], [text("reference"), watch("referenceNumber")], [text("notes"), watch("description")],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value || t("common.empty.dash")}</dd></div>)}</dl>
          </FormSection> : null}
        </fieldset>
      </FormBody>
      {summaryContainer ? createPortal(<CurrentTransactionSummary typeLabel={t("accounting.dailyIncome.wizard.typeSelector.options.LOAN-PAYMENT")} rows={[
        [text("employee"), watch("employeeName") || t("common.empty.dash")],
        [text("loan"), selectedLoan?.description || (selectedLoanId ? t("accounting.loans.fallbackDescription") : t("common.empty.dash"))],
        [text("journalDebit"), <JournalSummaryLine key="debit" account={receivedAccountName} amount={amount} />],
        [text("journalCredit"), <JournalSummaryLine key="credit" account={creditAccountName} amount={amount} />],
        [text("date"), watch("transactionDate") || t("common.empty.dash")],
        ...(watch("referenceNumber")?.trim() ? [[text("reference"), watch("referenceNumber")] as [string, string]] : []),
      ]} />, summaryContainer) : null}
      {guided ? <LoanEntryStepFooter kind="payment" step={flow.step} onStepChange={flow.setStep} busy={busy} typeStep={typeStep}
        onCancel={() => onOpenChange(false)} submitLabel={text("submit")} error={errors.root?.server?.message}
        warning={noActiveLoans ? text("balances.empty") : null} /> : (
      <FormFooter
        error={errors.root?.server?.message}
        warning={noActiveLoans ? text("balances.empty") : null}
        isSubmitting={busy}
        submitLabel={text("submit")}
        onCancel={() => onOpenChange(false)}
      />
      )}
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

export function BalanceTile({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-muted/20 p-3", emphasis && "border-primary/30 bg-primary/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", emphasis && "text-primary")}>{formatLoanMoney(value)}</p>
    </div>
  );
}

function LoanBalancesSummary({
  allocation,
  amount,
  employeeSelected,
  loanSelected,
  loading,
  error,
}: {
  allocation: LoanPaymentAllocation;
  amount: number;
  employeeSelected: boolean;
  loanSelected: boolean;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.loans.paymentForm.balances.${key}`, values);
  const { rows, totals, unapplied } = allocation;

  if (error && rows.length === 0) return <p role="alert" className="text-sm text-destructive">{text("loadError")}</p>;
  if (loading) return <p className="text-sm text-muted-foreground">{text("loading")}</p>;
  if (rows.length === 0) {
    const message = !employeeSelected
      ? text("selectEmployee")
      : loanSelected
        ? text("empty")
        : text("selectLoan");
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <BalanceTile label={text("originalAmount")} value={totals.principalAmount} />
        <BalanceTile label={text("paidSoFar")} value={totals.paidAmount} />
        <BalanceTile label={text("currentBalance")} value={totals.balance} emphasis />
      </div>

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
