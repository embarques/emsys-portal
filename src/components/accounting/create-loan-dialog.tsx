"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Banknote, Loader2, Save, User } from "lucide-react";
import { FormBody, FormFooterNoticeMessage, FormSection } from "@/components/forms/form-shell";
import { TransactionWizardStepper } from "./transaction-wizard-stepper";
import { LoanCloseoutPanel } from "./loan-closeout-panel";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useCreateLoanForm } from "@/lib/accounting/loans/use-create-loan-form";
import { formatLoanMoney } from "@/lib/accounting/loans/display";
import type { LoanCreateValues } from "@/lib/accounting/loans/types";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { useTranslation } from "@/lib/i18n";

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

function CreateLoanForm({ employees, loanAccounts, assetAccounts, pending, onSubmit, onOpenChange }: Props) {
  const { t } = useTranslation();
  const text = (key: string) => t(`accounting.loans.createForm.${key}`);
  const state = useCreateLoanForm(onSubmit, pending);
  const { form, step, busy, closeoutReady, setCloseoutReady } = state;
  const { register, setValue, watch, formState: { errors } } = form;
  const values = watch();
  const selectedAccount = loanAccounts.find(account => account.id === values.loanAccountId);
  const heading = useRef<HTMLHeadingElement>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const stepLabels = [text("steps.employee"), text("steps.details"), text("steps.review")];
  useEffect(() => { heading.current?.focus(); }, [step]);
  const fieldError = (name: keyof LoanCreateValues) => errors[name] ? <p role="alert" className="text-sm text-destructive">{errors[name]?.message}</p> : null;
  const requiredLabel = (id: string, label: string) => <Label htmlFor={id}>{label}<span className="text-destructive"> *</span></Label>;
  const review = (rows: Array<[string, string | undefined]>) => <dl className="grid gap-4 sm:grid-cols-2">
    {rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm font-medium">{value || t("common.empty.dash")}</dd></div>)}
  </dl>;
  return <form className="flex min-h-0 flex-1 flex-col" noValidate onKeyDown={handleEnterNavigation} onSubmit={event => { event.preventDefault(); void state.advance(); }}>
    <div className="shrink-0 border-b px-5 py-4"><TransactionWizardStepper step={step} labels={stepLabels} disabled={busy} onSelectStep={state.setStep} /></div>
    <FormBody workflow isBusy={busy}>
      <h2 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{stepLabels[step - 1]}</h2>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <FormSection variant="card" icon={User} title={text("steps.employee")} description={text("employeeHint")}>
            <div className="space-y-2">{requiredLabel("loan-employee", text("employee"))}
              <SearchableSelect id="loan-employee" aria-label={text("employee")} aria-invalid={Boolean(errors.employeeId)} value={values.employeeId ? String(values.employeeId) : ""}
                onValueChange={next => { const employee = employees.find(item => item.id === Number(next)); setValue("employeeId", employee?.id ?? 0, { shouldValidate: true }); setValue("employeeName", employee?.name ?? ""); }}
                options={employees.map(employee => ({ value: String(employee.id), label: employee.name }))} placeholder={text("selectEmployee")} searchPlaceholder={text("searchEmployees")} mobileSheet />
              {fieldError("employeeId")}
            </div>
          </FormSection>
        </div>
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <FormSection variant="card" icon={Banknote} title={text("accounts")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">{requiredLabel("loan-account", text("loanAccount"))}
                <SearchableSelect id="loan-account" aria-label={text("loanAccount")} aria-invalid={Boolean(errors.loanAccountId)} value={values.loanAccountId ? String(values.loanAccountId) : ""}
                  onValueChange={next => { const account = loanAccounts.find(item => item.id === Number(next)); if (account?.id !== values.loanAccountId) setCloseoutReady(false); setValue("loanAccountId", account?.id ?? 0, { shouldValidate: true }); setValue("loanAccountName", account?.displayName ?? account?.name ?? ""); setValue("loanAccountType", account?.type); }}
                  options={loanAccounts.map(account => ({ value: String(account.id), label: `${account.displayName ?? account.name}${account.branch?.name ? ` (${account.branch.name})` : ""}`, keywords: [account.name, account.displayName ?? "", account.branch?.name ?? ""] }))}
                  placeholder={text("selectLoanAccount")} searchPlaceholder={text("searchLoanAccounts")} mobileSheet />
                {fieldError("loanAccountId")}
              </div>
              <div className="space-y-2">{requiredLabel("loan-source-account", text("sourceAccount"))}
                <SearchableSelect id="loan-source-account" aria-label={text("sourceAccount")} aria-invalid={Boolean(errors.sourceAccountId)} value={values.sourceAccountId ? String(values.sourceAccountId) : ""}
                  onValueChange={next => { const account = assetAccounts.find(item => item.id === Number(next)); setValue("sourceAccountId", account?.id ?? 0, { shouldValidate: true }); setValue("sourceAccountName", account?.displayName ?? account?.name ?? ""); setValue("sourceAccountType", account?.type); }}
                  options={assetAccounts.map(account => ({ value: String(account.id), label: account.displayName ?? account.name, keywords: [account.name, account.displayName ?? ""] }))}
                  placeholder={text("selectSourceAccount")} searchPlaceholder={text("searchAssetAccounts")} mobileSheet />
                {fieldError("sourceAccountId")}
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
        <div className={step > 1 ? "" : "hidden"}>
          <LoanCloseoutPanel key={selectedAccount?.id ?? 0} branchId={selectedAccount?.branch?.id} branchCode={selectedAccount?.branch?.code} branchName={selectedAccount?.branch?.name} date={values.transactionDate} onReadyChange={setCloseoutReady} />
        </div>
      </fieldset>
    </FormBody>
    <div className="shrink-0 space-y-3 border-t bg-card px-5 py-4">
      {errors.root?.server?.message ? <FormFooterNoticeMessage tone="error" message={errors.root.server.message} /> : step > 1 && !closeoutReady ? <FormFooterNoticeMessage tone="warning" message={text("closeoutRequired")} /> : null}
      <div className="flex items-center justify-between gap-3">
        <div>{step > 1 ? <Button type="button" variant="outline" disabled={busy} onClick={() => state.setStep(step - 1)}><ArrowLeft className="size-4" />{t("common.actions.previous")}</Button> : null}</div>
        <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("common.actions.cancel")}</Button><Button type="submit" disabled={busy || (step > 1 && !closeoutReady)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : step === 3 ? <Save className="size-4" /> : <ArrowRight className="size-4" />}
          {busy ? t("common.actions.saving") : step === 3 ? text("title") : t("common.actions.next")}
        </Button></div>
      </div>
    </div>
  </form>;
}
