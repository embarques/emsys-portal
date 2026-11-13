"use client";

import { CreateLoanDialog, CreateLoanForm } from "@/components/accounting/create-loan-dialog";
import { LoanIncreaseForm } from "@/components/accounting/loan-increase-form";
import { RecordLoanPaymentDialog, RecordLoanPaymentForm } from "@/components/accounting/record-loan-payment-dialog";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import type { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";

type Props = {
  entry: ReturnType<typeof useLoanEntry>;
  employees: Array<{ id: number; name: string }>;
  accounts: ChartAccount[];
};

/** Lookups already belong to the entry workspace; loan lookup starts after choosing an employee. */
export function LoanEntryDialog({ entry, employees, accounts }: Props) {
  if (!entry.kind || entry.kind === "increase") return null;
  const assetAccounts = accounts.filter((account) => account.type === "ASSET" || account.type === "BANK");
  const onOpenChange = (open: boolean) => { if (!open) entry.close(); };
  return entry.kind === "issue" ? (
    <CreateLoanDialog key={`${entry.scope}:issue`} open onOpenChange={onOpenChange}
      employees={employees} loanAccounts={accounts.filter((account) => account.type === "LOAN")}
      assetAccounts={assetAccounts} pending={entry.pending} onSubmit={entry.submitCreate} />
  ) : (
    <RecordLoanPaymentDialog key={`${entry.scope}:payment`} open onOpenChange={onOpenChange}
      employees={employees} loans={[]} initialLoan={null} assetAccounts={assetAccounts}
      pending={entry.pending} onSubmit={entry.submitPayment} />
  );
}

/** Continuous variants reuse the dedicated forms and loan mutations inside transaction entry. */
export function LoanEntryForm({ entry, employees, accounts, onComplete, summaryContainer }: Props & { onComplete: () => void; summaryContainer?: HTMLElement | null }) {
  if (!entry.kind) return null;
  const assetAccounts = accounts.filter((account) => account.type === "ASSET" || account.type === "BANK");
  const onOpenChange = (open: boolean) => { if (!open) { entry.close(); onComplete(); } };
  if (entry.kind === "increase") {
    return (
      <LoanIncreaseForm key={`${entry.scope}:increase`} employees={employees} assetAccounts={assetAccounts}
        pending={entry.pending} guided summaryContainer={summaryContainer} onCancel={() => onOpenChange(false)}
        onSubmit={async (values) => { await entry.submitIncrease(values); onComplete(); }} />
    );
  }
  return entry.kind === "issue" ? (
    <CreateLoanForm key={`${entry.scope}:issue`} open continuous guided onOpenChange={onOpenChange}
      employees={employees} loanAccounts={accounts.filter((account) => account.type === "LOAN")}
      assetAccounts={assetAccounts} pending={entry.pending} summaryContainer={summaryContainer}
      onSubmit={async (values) => { await entry.submitCreate(values); onComplete(); }} />
  ) : (
    <RecordLoanPaymentForm key={`${entry.scope}:payment`} open onOpenChange={onOpenChange}
      employees={employees} loans={[]} initialLoan={null} assetAccounts={assetAccounts} guided summaryContainer={summaryContainer}
      pending={entry.pending} onSubmit={async (values) => { await entry.submitPayment(values); onComplete(); }} />
  );
}
