"use client";

import { CreateLoanDialog, CreateLoanForm } from "@/components/accounting/create-loan-dialog";
import type { GuidedTypeStep } from "@/components/accounting/guided-entry-chrome";
import { LoanIncreaseForm } from "@/components/accounting/loan-increase-form";
import { RecordLoanPaymentDialog, RecordLoanPaymentForm } from "@/components/accounting/record-loan-payment-dialog";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { listLoanFundingAccounts, listLoanReceivableAccounts } from "@/lib/accounting/loans/loan-accounts";
import type { Loan } from "@/lib/accounting/loans/types";
import type { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";

type Props = {
  entry: ReturnType<typeof useLoanEntry>;
  employees: Array<{ id: number; name: string }>;
  accounts: ChartAccount[];
  /** Prefills loan payment / increase when opened from a selected loan. */
  initialLoan?: Loan | null;
  /** Prefills payment employee when reducing loans without a specific loan. */
  initialEmployee?: { id: number; name: string } | null;
};

/** Lookups already belong to the entry workspace; loan lookup starts after choosing an employee. */
export function LoanEntryDialog({ entry, employees, accounts }: Props) {
  if (!entry.kind || entry.kind === "increase" || entry.kind === "decrease") return null;
  const fundingAccounts = listLoanFundingAccounts(accounts);
  const onOpenChange = (open: boolean) => { if (!open) entry.close(); };
  return entry.kind === "issue" ? (
    <CreateLoanDialog key={`${entry.scope}:issue`} open onOpenChange={onOpenChange}
      employees={employees} loanAccounts={listLoanReceivableAccounts(accounts)}
      assetAccounts={fundingAccounts} pending={entry.pending} onSubmit={entry.submitCreate} />
  ) : (
    <RecordLoanPaymentDialog key={`${entry.scope}:payment`} open onOpenChange={onOpenChange}
      employees={employees} loans={[]} initialLoan={null} assetAccounts={fundingAccounts}
      pending={entry.pending} onSubmit={entry.submitPayment} />
  );
}

/** Continuous variants reuse the dedicated forms and loan mutations inside transaction entry. */
export function LoanEntryForm({
  entry,
  employees,
  accounts,
  initialLoan = null,
  initialEmployee = null,
  onSaved,
  onDismiss,
  summaryContainer,
  typeStep,
}: Props & {
  /** After a successful save: keep the loan type and restart at step 1. */
  onSaved: () => void;
  /** Cancel / dismiss without saving: leave the loan workflow. */
  onDismiss: () => void;
  summaryContainer?: HTMLElement | null;
  typeStep: GuidedTypeStep;
}) {
  if (!entry.kind) return null;
  const fundingAccounts = listLoanFundingAccounts(accounts);
  const dismiss = () => {
    entry.close();
    onDismiss();
  };
  const onOpenChange = (open: boolean) => {
    if (!open) dismiss();
  };
  if (entry.kind === "increase" || entry.kind === "decrease") {
    const mode = entry.kind;
    return (
      <LoanIncreaseForm
        key={`${entry.scope}:${mode}`}
        employees={employees}
        assetAccounts={fundingAccounts}
        initialLoan={initialLoan}
        mode={mode}
        pending={entry.pending}
        guided
        typeStep={typeStep}
        summaryContainer={summaryContainer}
        onCancel={dismiss}
        onSubmit={async (values) => {
          if (mode === "decrease") await entry.submitDecrease(values);
          else await entry.submitIncrease(values);
          onSaved();
        }}
      />
    );
  }
  return entry.kind === "issue" ? (
    <CreateLoanForm key={`${entry.scope}:issue`} open continuous guided typeStep={typeStep} onOpenChange={onOpenChange}
      employees={employees} loanAccounts={listLoanReceivableAccounts(accounts)}
      assetAccounts={fundingAccounts} pending={entry.pending} summaryContainer={summaryContainer}
      onSubmit={async (values) => { await entry.submitCreate(values); onSaved(); }} />
  ) : (
    <RecordLoanPaymentForm key={`${entry.scope}:payment`} open onOpenChange={onOpenChange}
      employees={employees} loans={[]} initialLoan={initialLoan} initialEmployee={initialEmployee}
      assetAccounts={fundingAccounts} guided typeStep={typeStep} summaryContainer={summaryContainer}
      pending={entry.pending} onSubmit={async (values) => { await entry.submitPayment(values); onSaved(); }} />
  );
}
