"use client";

import { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Banknote, Landmark, ReceiptText, User } from "lucide-react";
import { JournalSummaryLine } from "@/components/accounting/loan-journal-summary-line";
import { BalanceTile } from "@/components/accounting/record-loan-payment-dialog";
import { CurrentTransactionSummary } from "@/components/accounting/transaction-review";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useEmployeeActiveLoans } from "@/lib/accounting/loans/hooks";
import { formatLoanDate, formatLoanMoney } from "@/lib/accounting/loans/display";
import { createLoanIncreaseSchema } from "@/lib/accounting/loans/schemas";
import type { LoanIncreaseValues } from "@/lib/accounting/loans/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useLoanEntrySteps } from "@/lib/accounting/loans/use-loan-entry-steps";
import { LoanEntryStepNavigation, LoanEntryStepFooter } from "@/components/accounting/loan-entry-step-navigation";
import { Button } from "@/components/ui/button";

type Props = {
  employees: Array<{ id: number; name: string }>;
  assetAccounts: ChartAccount[];
  pending: boolean;
  onSubmit: (values: LoanIncreaseValues) => Promise<void>;
  onCancel: () => void;
  summaryContainer?: HTMLElement | null;
  guided?: boolean;
};

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

function accountLabel(account?: { displayName?: string; name: string }) {
  return account ? account.displayName ?? account.name : "";
}

/** Adds an amount to an employee's existing active loan (debit loan account, credit source asset). */
export function LoanIncreaseForm({ employees, assetAccounts, pending, onSubmit, onCancel, summaryContainer, guided = false }: Props) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.loans.increaseForm.${key}`, values);
  const schema = useMemo(() => createLoanIncreaseSchema(t), [t]);
  const handleEnterNavigation = useFormEnterNavigation();
  const submitting = useRef(false);
  const form = useForm<LoanIncreaseValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: 0,
      loanId: "",
      sourceAccountId: 0,
      amount: 0,
      transactionDate: new Date().toISOString().slice(0, 10),
      referenceNumber: "",
      description: "",
    },
  });
  const { register, setValue, watch, formState: { errors } } = form;
  const busy = pending || form.formState.isSubmitting;
  const flow = useLoanEntrySteps(form, ["employeeId", "loanId"], guided);
  const stageClass = (stage: number) => guided && flow.step !== stage ? "hidden" : undefined;
  const values = watch();
  const amount = Number(values.amount) || 0;
  const loansQuery = useEmployeeActiveLoans(values.employeeId);
  const loans = loansQuery.data?.items ?? [];
  const selectedLoan = loans.find((loan) => loan.id === values.loanId);
  const loanAccountName = accountLabel(selectedLoan?.loanAccount);
  const noActiveLoans = values.employeeId > 0 && loansQuery.isSuccess && loans.length === 0;

  const fieldError = (name: keyof LoanIncreaseValues) =>
    errors[name] ? <p role="alert" className="text-sm text-destructive">{errors[name]?.message}</p> : null;
  const requiredLabel = (id: string, label: string) => (
    <Label htmlFor={id}>{label}<span className="text-destructive"> *</span></Label>
  );

  const submit = form.handleSubmit(async (submitted) => {
    if (submitting.current || pending) return;
    submitting.current = true;
    form.clearErrors("root.server");
    try {
      await onSubmit(submitted);
    } catch (error) {
      form.setError("root.server", { message: normalizeApiError(error).message });
    } finally {
      submitting.current = false;
    }
  });

  const journalSummary = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{text("journalDebit")}</p>
        <JournalSummaryLine account={loanAccountName} amount={amount} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{text("journalCredit")}</p>
        <JournalSummaryLine account={values.sourceAccountName} amount={amount} />
      </div>
    </div>
  );

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onKeyDown={handleEnterNavigation} onSubmit={(event) => flow.advance(event, submit)}>
      {guided ? <LoanEntryStepNavigation step={flow.step} onStepChange={flow.setStep} busy={busy} /> : null}
      <FormBody workflow isBusy={busy}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <FormSection className={stageClass(1)} variant="card" icon={User} title={text("sections.loan")} description={text("loanHint")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {requiredLabel("loan-increase-employee", text("employee"))}
                <SearchableSelect
                  inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                  id="loan-increase-employee"
                  aria-label={text("employee")}
                  aria-invalid={Boolean(errors.employeeId)}
                  value={values.employeeId ? String(values.employeeId) : ""}
                  onValueChange={(next) => {
                    const employee = employees.find((item) => item.id === Number(next));
                    setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                    setValue("employeeName", employee?.name ?? "");
                    setValue("loanId", "");
                  }}
                  options={employees.map((employee) => ({ value: String(employee.id), label: employee.name, keywords: [employee.name] }))}
                  placeholder={text("selectEmployee")}
                  searchPlaceholder={text("searchEmployees")}
                  mobileSheet
                />
                {fieldError("employeeId")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-increase-loan", text("loan"))}
                <SearchableSelect
                  inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                  id="loan-increase-loan"
                  aria-label={text("loan")}
                  aria-invalid={Boolean(errors.loanId)}
                  value={values.loanId}
                  onValueChange={(next) => setValue("loanId", next, { shouldValidate: true })}
                  options={loans.map((loan) => ({
                    value: loan.id,
                    label: loan.description || t("accounting.loans.fallbackDescription"),
                    description: text("loanOptionDescription", {
                      opened: formatLoanDate(loan.openedAt) || t("common.empty.dash"),
                      balance: formatLoanMoney(loan.balance),
                    }),
                    keywords: [loan.description, loan.referenceNumber],
                  }))}
                  placeholder={values.employeeId ? text("selectLoan") : text("selectEmployeeFirst")}
                  searchPlaceholder={text("searchLoans")}
                  emptyMessage={text("noActiveLoans")}
                  loading={values.employeeId > 0 && loansQuery.isPending}
                  disabled={!values.employeeId}
                  mobileSheet
                />
                {fieldError("loanId")}
              </div>
            </div>
          </FormSection>

          {selectedLoan ? (
            <FormSection className={guided && flow.step === 1 ? "hidden" : undefined} variant="card" icon={Landmark} title={text("sections.balance")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <BalanceTile label={text("originalAmount")} value={selectedLoan.principalAmount} />
                <BalanceTile label={text("currentBalance")} value={selectedLoan.balance} />
                <BalanceTile label={text("balanceAfter")} value={selectedLoan.balance + amount} emphasis />
              </div>
            </FormSection>
          ) : null}

          <FormSection className={stageClass(2)} variant="card" icon={ReceiptText} title={text("sections.amount")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                {requiredLabel("loan-increase-source-account", text("sourceAccount"))}
                <SearchableSelect
                  inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                  id="loan-increase-source-account"
                  aria-label={text("sourceAccount")}
                  aria-invalid={Boolean(errors.sourceAccountId)}
                  value={values.sourceAccountId ? String(values.sourceAccountId) : ""}
                  onValueChange={(next) => {
                    const account = assetAccounts.find((item) => item.id === Number(next));
                    setValue("sourceAccountId", account?.id ?? 0, { shouldValidate: true });
                    setValue("sourceAccountName", accountLabel(account));
                    setValue("sourceAccountType", account?.type);
                  }}
                  options={assetAccounts.map((account) => ({ value: String(account.id), label: accountLabel(account), keywords: [account.name, account.displayName ?? ""] }))}
                  placeholder={text("selectSourceAccount")}
                  searchPlaceholder={text("searchAssetAccounts")}
                  mobileSheet
                />
                {fieldError("sourceAccountId")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-increase-amount", text("amount"))}
                <Input
                  id="loan-increase-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  aria-invalid={Boolean(errors.amount)}
                  {...register("amount", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                />
                {fieldError("amount")}
              </div>
              <div className="space-y-2">
                {requiredLabel("loan-increase-date", text("date"))}
                <DateInput id="loan-increase-date" aria-invalid={Boolean(errors.transactionDate)} {...register("transactionDate")} />
                {fieldError("transactionDate")}
              </div>
            </div>
          </FormSection>

          <FormSection className={stageClass(2)} variant="card" title={text("sections.notes")}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loan-increase-reference">{text("reference")}</Label>
                <Input id="loan-increase-reference" placeholder={text("optional")} {...register("referenceNumber")} />
                {fieldError("referenceNumber")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-increase-description">{text("notes")}</Label>
                <textarea id="loan-increase-description" rows={3} className={textareaClassName} placeholder={text("notesPlaceholder")} {...register("description")} />
                {fieldError("description")}
              </div>
            </div>
          </FormSection>

          {summaryContainer && (!guided || flow.step !== 3) ? null : (
            <FormSection variant="card" icon={Banknote} title={text("sections.journal")}>{journalSummary}</FormSection>
          )}
          {guided && flow.step === 3 ? <FormSection variant="card" title={t("accounting.dailyIncome.wizard.quickFlow.review")} action={<Button type="button" variant="ghost" onClick={() => flow.setStep(2)}>{t("common.actions.edit")}</Button>}>
            <dl className="grid gap-4 sm:grid-cols-2">{[
              [text("employee"), values.employeeName], [text("loan"), selectedLoan?.description || t("accounting.loans.fallbackDescription")],
              [text("sourceAccount"), values.sourceAccountName], [text("amount"), formatLoanMoney(amount)],
              [text("date"), values.transactionDate], [text("reference"), values.referenceNumber], [text("notes"), values.description],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value || t("common.empty.dash")}</dd></div>)}</dl>
          </FormSection> : null}
        </fieldset>
      </FormBody>
      {summaryContainer ? createPortal(<CurrentTransactionSummary typeLabel={t("accounting.dailyIncome.wizard.typeSelector.options.LOAN-INCREASE")} rows={[
        [text("employee"), values.employeeName || t("common.empty.dash")],
        [text("loan"), selectedLoan ? selectedLoan.description || t("accounting.loans.fallbackDescription") : t("common.empty.dash")],
        ...(selectedLoan ? [[text("balanceAfter"), formatLoanMoney(selectedLoan.balance + amount)] as [string, string]] : []),
        [text("journalDebit"), <JournalSummaryLine key="debit" account={loanAccountName} amount={amount} />],
        [text("journalCredit"), <JournalSummaryLine key="credit" account={values.sourceAccountName} amount={amount} />],
        [text("date"), values.transactionDate || t("common.empty.dash")],
        ...(values.referenceNumber?.trim() ? [[text("reference"), values.referenceNumber] as [string, string]] : []),
      ]} />, summaryContainer) : null}
      {guided ? <LoanEntryStepFooter step={flow.step} onStepChange={flow.setStep} busy={busy}
        onCancel={onCancel} submitLabel={text("submit")} error={errors.root?.server?.message}
        warning={noActiveLoans ? text("noActiveLoans") : null} /> : (
      <FormFooter
        error={errors.root?.server?.message}
        warning={noActiveLoans ? text("noActiveLoans") : null}
        isSubmitting={busy}
        submitLabel={text("submit")}
        onCancel={onCancel}
      />
      )}
    </form>
  );
}
