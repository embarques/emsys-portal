"use client";

import { useEffect, useState } from "react";

import { LoanEntryForm } from "@/components/accounting/loan-entry-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import type { Loan } from "@/lib/accounting/loans/types";
import type { LoanEntryKind, useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
import { useTranslation } from "@/lib/i18n";

export type LoanWorkflowKind = Extract<LoanEntryKind, "issue" | "payment" | "increase" | "decrease">;

type Props = {
  open: boolean;
  kind: LoanWorkflowKind | null;
  entry: ReturnType<typeof useLoanEntry>;
  /** Prefills payment allocation when opened from a selected loan. Cleared after the first save. */
  initialLoan?: Loan | null;
  /** When set without initialLoan, payment opens in oldest-first mode for this employee. */
  initialEmployee?: { id: number; name: string } | null;
  employees: Array<{ id: number; name: string }>;
  accounts: ChartAccount[];
  onOpenChange: (open: boolean) => void;
  /** Clears a one-shot payment prefill after the first successful save (batch continue). */
  onConsumedInitialLoan?: () => void;
};

const TYPE_OPTION_KEY: Record<LoanWorkflowKind, string> = {
  issue: "LOAN-ISSUE",
  payment: "LOAN-PAYMENT",
  increase: "LOAN-INCREASE",
  decrease: "LOAN-DECREASE",
};

/**
 * Same guided loan steps as Add Transaction (issue / payment / increase), hosted from the loans directory.
 */
export function LoanWorkflowDialog({
  open,
  kind,
  entry,
  initialLoan = null,
  initialEmployee = null,
  employees,
  accounts,
  onOpenChange,
  onConsumedInitialLoan,
}: Props) {
  const { t } = useTranslation();
  const [sessionKey, setSessionKey] = useState(0);
  const [paymentSeed, setPaymentSeed] = useState<Loan | null>(null);
  const [employeeSeed, setEmployeeSeed] = useState<{ id: number; name: string } | null>(null);
  const [principalSeed, setPrincipalSeed] = useState<Loan | null>(null);
  const [activeKind, setActiveKind] = useState<LoanWorkflowKind | null>(null);

  useEffect(() => {
    if (!open || !kind) {
      entry.close();
      setActiveKind(null);
      setPaymentSeed(null);
      setEmployeeSeed(null);
      setPrincipalSeed(null);
      return;
    }

    setActiveKind(kind);
    setPaymentSeed(kind === "payment" ? initialLoan : null);
    setEmployeeSeed(kind === "payment" && !initialLoan ? initialEmployee : null);
    setPrincipalSeed(kind === "increase" || kind === "decrease" ? initialLoan : null);
    setSessionKey((key) => key + 1);
    if (kind === "issue") entry.openCreate?.();
    else if (kind === "increase") entry.openIncrease?.();
    else if (kind === "decrease") entry.openDecrease?.();
    else entry.openPayment?.();
    // Host controls when the workflow opens; entry open helpers are intentionally invoked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, initialLoan?.id, initialEmployee?.id]);

  function closeWorkflow() {
    if (entry.pending) return;
    entry.close();
    setActiveKind(null);
    setPaymentSeed(null);
    setEmployeeSeed(null);
    setPrincipalSeed(null);
    onOpenChange(false);
  }

  const typeKey = activeKind ? TYPE_OPTION_KEY[activeKind] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeWorkflow();
      }}
    >
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
        <DialogHeader className="relative shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle>{t("accounting.dailyIncome.wizard.addTitle")}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
        </DialogHeader>

        {open && activeKind && typeKey ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <LoanEntryForm
              key={`${activeKind}:${sessionKey}:${paymentSeed?.id ?? principalSeed?.id ?? employeeSeed?.id ?? "new"}`}
              entry={entry}
              employees={employees}
              accounts={accounts}
              initialLoan={paymentSeed ?? principalSeed}
              initialEmployee={employeeSeed}
              typeStep={{
                label: t(`accounting.dailyIncome.wizard.typeSelector.options.${typeKey}`),
                onBack: closeWorkflow,
                onCancel: closeWorkflow,
                // Type is chosen before open; progress is Employee/loan → Amount & details → Review only.
                includeInStepper: false,
              }}
              onSaved={() => {
                // Match add-transaction batch continue: keep the type, clear seed, restart at step 1.
                setPaymentSeed(null);
                setEmployeeSeed(null);
                setPrincipalSeed(null);
                onConsumedInitialLoan?.();
                setSessionKey((key) => key + 1);
                if (activeKind === "issue") entry.openCreate?.();
                else if (activeKind === "increase") entry.openIncrease?.();
                else if (activeKind === "decrease") entry.openDecrease?.();
                else entry.openPayment?.();
              }}
              onDismiss={closeWorkflow}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
