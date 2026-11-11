"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { normalizeApiError } from "@/lib/api/api-error";
import { store } from "@/lib/store/store";
import { useTranslation } from "@/lib/i18n";
import { useCreateLoan, useIncreaseLoan, useRecordLoanPayment } from "@/lib/accounting/loans/hooks";
import { isLoanIncreaseEnabled } from "./loan-increase";
import type { LoanCreateValues, LoanIncreaseValues, LoanPaymentValues } from "./types";

export type LoanEntryKind = "issue" | "increase" | "payment";

/** Reuses the existing loan APIs; neither action is a generic journal create. */
export function useLoanEntry() {
  const { companyId, user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const scope = `${companyId}:${user?.uid}`;
  const activeScope = useRef(scope);
  useEffect(() => {
    activeScope.current = scope;
    return () => { activeScope.current = ""; };
  }, [scope]);
  const [selection, setSelection] = useState<{ scope: string; kind: LoanEntryKind } | null>(null);
  const create = useCreateLoan();
  const increase = useIncreaseLoan();
  const payment = useRecordLoanPayment();
  // Add transaction uses these existing accounting grants; dedicated loan grants
  // are not defined in the current frontend permission contract.
  const permitted = Boolean(companyId && hasPermission("canCreateJournal", "journal") && hasPermission("canViewIncomeStatement", "income_statement"));
  const increasePermitted = permitted && isLoanIncreaseEnabled();
  const kind = permitted && selection?.scope === scope && (selection.kind !== "increase" || increasePermitted) ? selection.kind : null;
  const pending = create.isPending || increase.isPending || payment.isPending;
  const close = () => { if (!pending) setSelection(null); };

  async function submit<T>(expected: LoanEntryKind, mutate: (values: T) => Promise<unknown>, values: T, successKey: string) {
    if (!permitted || kind !== expected || activeScope.current !== scope || store.getState().auth.companyId !== companyId) throw new Error(t("common.errors.forbidden"));
    if (pending) return;
    try {
      await mutate(values);
      if (activeScope.current !== scope) return;
      notifySuccess(t(successKey));
      setSelection(null);
    } catch (error) { if (activeScope.current === scope) notifyError(normalizeApiError(error).message); throw error; }
  }

  return {
    kind, scope, pending, close,
    submitCreate: (values: LoanCreateValues) => submit("issue", create.mutateAsync, values, "accounting.loans.toasts.created"),
    submitIncrease: (values: LoanIncreaseValues) => submit("increase", increase.mutateAsync, values, "accounting.loans.toasts.increased"),
    submitPayment: (values: LoanPaymentValues) => submit("payment", payment.mutateAsync, values, "accounting.loans.toasts.paymentRecorded"),
    openCreate: permitted ? () => setSelection({ scope, kind: "issue" }) : undefined,
    openIncrease: increasePermitted ? () => setSelection({ scope, kind: "increase" }) : undefined,
    openPayment: permitted ? () => setSelection({ scope, kind: "payment" }) : undefined,
  };
}
