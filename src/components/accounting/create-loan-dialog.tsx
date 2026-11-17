"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, Banknote, Loader2, Save, User } from "lucide-react";
import { FormBody, FormFooterNoticeMessage, FormSection } from "@/components/forms/form-shell";
import { TransactionWizardStepper } from "./transaction-wizard-stepper";
import type { GuidedTypeStep } from "./guided-entry-chrome";
import { LoanEntryStepFooter, LoanEntryStepHeading, LoanEntryStepNavigation } from "./loan-entry-step-navigation";
import { LoanCloseoutGate, LoanCloseoutPanel } from "./loan-closeout-panel";
import { JournalSummaryLine } from "./loan-journal-summary-line";
import { CurrentTransactionSummary } from "./transaction-review";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { LoanEmployeeField } from "@/components/accounting/loan-employee-field";
import { FieldLabelRow } from "@/components/forms/field-label-row";
import { FieldMessage } from "@/components/forms/field-message";
import { useCreateLoanForm } from "@/lib/accounting/loans/use-create-loan-form";
import { formatLoanMoney } from "@/lib/accounting/loans/display";
import type { LoanCreateValues } from "@/lib/accounting/loans/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: number; name: string }>;
  loanAccounts: ChartAccount[];
  assetAccounts: ChartAccount[];
  onSubmit: (values: LoanCreateValues) => Promise<void>;
  pending: boolean;
};

export function CreateLoanDialog(props: Props) {
  const { t } = useTranslation();
  return <Dialog open={props.open} onOpenChange={open => { if (!props.pending) props.onOpenChange(open); }}>
    <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader className="shrink-0 border-b px-5 py-4">
        <DialogTitle>{t("accounting.loans.createForm.title")}</DialogTitle>
        <DialogDescription>{t("accounting.loans.createForm.description")}</DialogDescription>
      </DialogHeader>
      {props.open ? <CreateLoanForm {...props} /> : null}
    </DialogContent>
  </Dialog>;
}

export function CreateLoanForm({ employees, loanAccounts, assetAccounts, pending, onSubmit, onOpenChange, continuous = false, guided = false, summaryContainer, typeStep }: Props & { continuous?: boolean; guided?: boolean; summaryContainer?: HTMLElement | null; typeStep?: GuidedTypeStep }) {
  const { t } = useTranslation();
  const text = (key: string) => t(`accounting.loans.createForm.${key}`);
  const singlePage = continuous && !guided;
  const state = useCreateLoanForm(onSubmit, pending, singlePage);
  const { form, step, busy, closeoutReady, setCloseoutReady } = state;
  const { register, setValue, watch, formState: { errors } } = form;
  const values = watch();
  const selectedAccount = loanAccounts.find(account => account.id === values.loanAccountId);
  const inlineOptionsLimit = guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined;
  const loanAccountOptions = loanAccounts.map(account => ({ value: String(account.id), label: `${account.displayName ?? account.name}${account.branch?.name ? ` (${account.branch.name})` : ""}`, keywords: [account.name, account.displayName ?? "", account.branch?.name ?? ""] }));
  const loanAccountInline = getInlineSelectOptions({ inlineOptionsLimit, options: loanAccountOptions, value: values.loanAccountId ? String(values.loanAccountId) : "", placeholder: text("selectLoanAccount") }) !== null;
  const sourceAccountOptions = assetAccounts.map(account => ({ value: String(account.id), label: account.displayName ?? account.name, keywords: [account.name, account.displayName ?? ""] }));
  const sourceAccountInline = getInlineSelectOptions({ inlineOptionsLimit, options: sourceAccountOptions, value: values.sourceAccountId ? String(values.sourceAccountId) : "", placeholder: text("selectSourceAccount") }) !== null;
  const heading = useRef<HTMLHeadingElement>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const stepLabels = [text("steps.employee"), text("steps.details"), text("steps.review")];
  useEffect(() => { heading.current?.focus(); }, [step]);
  const fieldError = (name: keyof LoanCreateValues) => errors[name] ? <p role="alert" className="text-sm text-destructive">{errors[name]?.message}</p> : null;
  const requiredLabel = (id: string, label: string) => <Label htmlFor={id}>{label}<span className="text-destructive" aria-hidden="true"> *</span></Label>;
  const accountRoleBadge = (role: "debit" | "credit") => (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
      role === "debit" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    )}>
      {text(role === "debit" ? "debitRole" : "creditRole")}
    </span>
  );
  const review = (rows: Array<[string, string | undefined]>) => <dl className="grid gap-4 sm:grid-cols-2">
    {rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm font-medium">{value || t("common.empty.dash")}</dd></div>)}
  </dl>;
  return <form className="flex min-h-0 flex-1 flex-col" noValidate onKeyDown={handleEnterNavigation} onSubmit={event => { event.preventDefault(); void state.advance(); }}>
    {guided ? <LoanEntryStepNavigation kind="issue" step={step} onStepChange={state.setStep} busy={busy} typeStep={typeStep} />
      : !singlePage ? <div className="shrink-0 border-b px-5 py-4"><TransactionWizardStepper step={step} labels={stepLabels} disabled={busy} onSelectStep={state.setStep} /></div> : null}
    <FormBody workflow className={guided ? "lg:p-8" : undefined} isBusy={busy}>
      {guided ? <LoanEntryStepHeading kind="issue" step={step} appearance={typeStep?.appearance} />
        : !singlePage ? <header className="max-w-2xl space-y-2"><h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{stepLabels[step - 1]}</h2></header> : null}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className={singlePage || step === 1 ? "space-y-4" : "hidden"}>
          <FormSection variant="card" icon={User} title={text("steps.employee")} description={text("employeeHint")}>
            <LoanEmployeeField
              id="loan-employee"
              label={text("employee")}
              employees={employees}
              value={values.employeeId || undefined}
              valueName={values.employeeName}
              error={errors.employeeId?.message}
              guided={guided}
              placeholder={text("selectEmployee")}
              searchPlaceholder={text("searchEmployees")}
              onChange={(employee) => {
                setValue("employeeId", employee?.id ?? 0, { shouldValidate: true });
                setValue("employeeName", employee?.name ?? "");
              }}
            />
          </FormSection>
        </div>
        <div className={singlePage || step === 2 ? "space-y-4" : "hidden"}>
          <FormSection variant="card" icon={Banknote} title={text("accounts")} description={text("accountsHint")}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-3">
              <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/80 bg-muted/25 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  {accountRoleBadge("debit")}
                </div>
                <div className="space-y-2">
                  <FieldLabelRow
                    showClear={Boolean(values.loanAccountId) && loanAccountInline}
                    onClear={() => { setCloseoutReady(false); setValue("loanAccountId", 0, { shouldValidate: true }); setValue("loanAccountName", ""); setValue("loanAccountType", undefined); window.requestAnimationFrame(() => document.getElementById("loan-account")?.focus()); }}
                  >
                    {requiredLabel("loan-account", text("loanAccount"))}
                  </FieldLabelRow>
                  <SearchableSelect
                    inlineOptionsLimit={inlineOptionsLimit} clearable={false} id="loan-account" aria-label={text("loanAccount")} aria-invalid={Boolean(errors.loanAccountId)} value={values.loanAccountId ? String(values.loanAccountId) : ""}
                    onValueChange={next => { const account = loanAccounts.find(item => item.id === Number(next)); if (account?.id !== values.loanAccountId) setCloseoutReady(false); setValue("loanAccountId", account?.id ?? 0, { shouldValidate: true }); setValue("loanAccountName", account?.displayName ?? account?.name ?? ""); setValue("loanAccountType", account?.type); }}
                    options={loanAccountOptions}
                    placeholder={text("selectLoanAccount")} searchPlaceholder={text("searchLoanAccounts")} mobileSheet
                    className="min-h-12" />
                  <FieldMessage error={errors.loanAccountId?.message} hint={text("loanAccountHint")} />
                </div>
              </div>
              <span aria-hidden="true" className="flex items-center justify-center py-0.5 text-muted-foreground sm:px-0.5">
                <ArrowDown className="size-4 shrink-0 sm:hidden" />
                <ArrowLeftRight className="hidden size-4 shrink-0 sm:block" />
              </span>
              <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/80 bg-muted/25 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  {accountRoleBadge("credit")}
                </div>
                <div className="space-y-2">
                  <FieldLabelRow
                    showClear={Boolean(values.sourceAccountId) && sourceAccountInline}
                    onClear={() => { setValue("sourceAccountId", 0, { shouldValidate: true }); setValue("sourceAccountName", ""); setValue("sourceAccountType", undefined); window.requestAnimationFrame(() => document.getElementById("loan-source-account")?.focus()); }}
                  >
                    {requiredLabel("loan-source-account", text("sourceAccount"))}
                  </FieldLabelRow>
                  <SearchableSelect
                    inlineOptionsLimit={inlineOptionsLimit} clearable={false} id="loan-source-account" aria-label={text("sourceAccount")} aria-invalid={Boolean(errors.sourceAccountId)} value={values.sourceAccountId ? String(values.sourceAccountId) : ""}
                    onValueChange={next => { const account = assetAccounts.find(item => item.id === Number(next)); setValue("sourceAccountId", account?.id ?? 0, { shouldValidate: true }); setValue("sourceAccountName", account?.displayName ?? account?.name ?? ""); setValue("sourceAccountType", account?.type); }}
                    options={sourceAccountOptions}
                    placeholder={text("selectSourceAccount")} searchPlaceholder={text("searchAssetAccounts")} mobileSheet
                    className="min-h-12" />
                  <FieldMessage error={errors.sourceAccountId?.message} hint={text("sourceAccountHint")} />
                </div>
              </div>
            </div>
          </FormSection>
          <FormSection variant="card" title={text("amountAndDate")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">{requiredLabel("loan-principal", text("principal"))}<Input id="loan-principal" type="number" min="0.01" step="0.01" {...register("principalAmount", { setValueAs: value => value === "" ? undefined : Number(value) })} />{fieldError("principalAmount")}</div>
              <div className="space-y-2">{requiredLabel("loan-date", text("date"))}<DateInput id="loan-date" {...register("transactionDate")} />{fieldError("transactionDate")}</div>
            </div>
          </FormSection>
          <FormSection variant="card" title={text("notes")}>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="loan-reference">{text("reference")}</Label><Input id="loan-reference" placeholder={text("optional")} {...register("referenceNumber")} />{fieldError("referenceNumber")}</div>
              <div className="space-y-2"><Label htmlFor="loan-description">{text("notesDescription")}</Label><textarea id="loan-description" rows={3} className="flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" placeholder={text("notesPlaceholder")} {...register("description")} />{fieldError("description")}</div>
            </div>
          </FormSection>
        </div>
        {step === 3 ? <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.wizard.workflow.reviewHint")}</p>
          <FormSection variant="card" title={text("steps.employee")} action={<Button type="button" variant="ghost" size="sm" onClick={() => state.setStep(1)}>{t("common.actions.edit")}</Button>}>
            {review([[text("employee"), values.employeeName]])}
          </FormSection>
          <FormSection variant="card" title={text("steps.details")} action={<Button type="button" variant="ghost" size="sm" onClick={() => state.setStep(2)}>{t("common.actions.edit")}</Button>}>
            {review([[text("loanAccount"), values.loanAccountName], [text("sourceAccount"), values.sourceAccountName], [text("principal"), formatLoanMoney(values.principalAmount)], [text("date"), values.transactionDate], [text("reference"), values.referenceNumber], [text("notesDescription"), values.description]])}
          </FormSection>
          <FormSection variant="card" icon={Banknote} title={text("journalSummary")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><p className="text-xs text-muted-foreground">{text("debit")}</p><p className="text-sm font-medium">{values.loanAccountName}</p><p className="text-lg font-semibold tabular-nums">{formatLoanMoney(values.principalAmount)}</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">{text("credit")}</p><p className="text-sm font-medium">{values.sourceAccountName}</p><p className="text-lg font-semibold tabular-nums">{formatLoanMoney(values.principalAmount)}</p></div>
            </div>
          </FormSection>
        </div> : null}
        {continuous ? (
          <LoanCloseoutGate key={selectedAccount?.id ?? 0} branchId={selectedAccount?.branch?.id} date={values.transactionDate} onReadyChange={setCloseoutReady} />
        ) : (
          <div className={step > 1 ? "" : "hidden"}>
            <LoanCloseoutPanel key={selectedAccount?.id ?? 0} branchId={selectedAccount?.branch?.id} branchCode={selectedAccount?.branch?.code} branchName={selectedAccount?.branch?.name} date={values.transactionDate} onReadyChange={setCloseoutReady} />
          </div>
        )}
      </fieldset>
    </FormBody>
    {summaryContainer ? createPortal(<CurrentTransactionSummary typeLabel={t("accounting.dailyIncome.wizard.typeSelector.options.LOAN-ISSUE")} rows={[
      [text("employee"), values.employeeName || t("common.empty.dash")],
      [text("debit"), <JournalSummaryLine key="debit" account={values.loanAccountName} amount={values.principalAmount} />],
      [text("credit"), <JournalSummaryLine key="credit" account={values.sourceAccountName} amount={values.principalAmount} />],
      [text("date"), values.transactionDate || t("common.empty.dash")],
      ...(values.referenceNumber?.trim() ? [[text("reference"), values.referenceNumber] as [string, string]] : []),
    ]} />, summaryContainer) : null}
    {guided ? <LoanEntryStepFooter kind="issue" step={step} onStepChange={state.setStep} busy={busy} typeStep={typeStep}
      onCancel={() => onOpenChange(false)} submitLabel={text("title")} error={errors.root?.server?.message}
      warning={step > 1 && !closeoutReady ? text("closeoutRequired") : null} submitDisabled={step > 1 && !closeoutReady} /> : (
    <div className="shrink-0 space-y-3 border-t bg-card px-5 py-4">
      {errors.root?.server?.message ? <FormFooterNoticeMessage tone="error" message={errors.root.server.message} /> : (singlePage || step > 1) && !closeoutReady ? <FormFooterNoticeMessage tone="warning" message={text("closeoutRequired")} /> : null}
      <div className="flex items-center justify-between gap-3">
        <div>{!singlePage && step > 1 ? <Button type="button" variant="outline" disabled={busy} onClick={() => state.setStep(step - 1)}><ArrowLeft className="size-4" />{t("common.actions.previous")}</Button> : null}</div>
        <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("common.actions.cancel")}</Button><Button type="submit" disabled={busy || ((singlePage || step > 1) && !closeoutReady)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : singlePage || step === 3 ? <Save className="size-4" /> : <ArrowRight className="size-4" />}
          {busy ? t("common.actions.saving") : singlePage || step === 3 ? text("title") : t("common.actions.next")}
        </Button></div>
      </div>
    </div>
    )}
  </form>;
}
