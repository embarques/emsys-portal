"use client";

import { CreateLoanDialog, CreateLoanForm } from "@/components/accounting/create-loan-dialog";
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
  if (!entry.kind) return null;
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
export function LoanEntryForm({ entry, employees, accounts, onComplete }: Props & { onComplete: () => void }) {
  if (!entry.kind) return null;
  const assetAccounts = accounts.filter((account) => account.type === "ASSET" || account.type === "BANK");
  const onOpenChange = (open: boolean) => { if (!open) { entry.close(); onComplete(); } };
  return entry.kind === "issue" ? (
    <CreateLoanForm key={`${entry.scope}:issue`} open continuous onOpenChange={onOpenChange}
      employees={employees} loanAccounts={accounts.filter((account) => account.type === "LOAN")}
      assetAccounts={assetAccounts} pending={entry.pending}
      onSubmit={async (values) => { await entry.submitCreate(values); onComplete(); }} />
  ) : (
    <RecordLoanPaymentForm key={`${entry.scope}:payment`} open onOpenChange={onOpenChange}
      employees={employees} loans={[]} initialLoan={null} assetAccounts={assetAccounts}
      pending={entry.pending} onSubmit={async (values) => { await entry.submitPayment(values); onComplete(); }} />
  );
}
