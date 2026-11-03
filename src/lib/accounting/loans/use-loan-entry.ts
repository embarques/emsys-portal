"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { normalizeApiError } from "@/lib/api/api-error";
import { store } from "@/lib/store/store";
import { useTranslation } from "@/lib/i18n";
import { useCreateLoan, useRecordLoanPayment } from "@/lib/accounting/loans/hooks";
import type { LoanCreateValues, LoanPaymentValues } from "./types";

export type LoanEntryKind = "issue" | "payment";

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
  const payment = useRecordLoanPayment();
  // Add transaction uses these existing accounting grants; dedicated loan grants
  // are not defined in the current frontend permission contract.
  const permitted = Boolean(companyId && hasPermission("canCreateJournal", "journal") && hasPermission("canViewIncomeStatement", "income_statement"));
  const kind = permitted && selection?.scope === scope ? selection.kind : null;
  const pending = create.isPending || payment.isPending;
  const close = () => { if (!pending) setSelection(null); };

  async function submitCreate(values: LoanCreateValues) {
    if (!permitted || kind !== "issue" || activeScope.current !== scope || store.getState().auth.companyId !== companyId) throw new Error(t("common.errors.forbidden"));
    if (pending) return;
    try {
      await create.mutateAsync(values);
      if (activeScope.current !== scope) return;
      notifySuccess(t("accounting.loans.toasts.created"));
      setSelection(null);
    } catch (error) { if (activeScope.current === scope) notifyError(normalizeApiError(error).message); throw error; }
  }

  async function submitPayment(values: LoanPaymentValues) {
    if (!permitted || kind !== "payment" || activeScope.current !== scope || store.getState().auth.companyId !== companyId) throw new Error(t("common.errors.forbidden"));
    if (pending) return;
    try {
      await payment.mutateAsync(values);
      if (activeScope.current !== scope) return;
      notifySuccess(t("accounting.loans.toasts.paymentRecorded"));
      setSelection(null);
    } catch (error) { if (activeScope.current === scope) notifyError(normalizeApiError(error).message); throw error; }
  }

  return {
    kind, scope, pending, close, submitCreate, submitPayment,
    openCreate: permitted ? () => setSelection({ scope, kind: "issue" }) : undefined,
    openPayment: permitted ? () => setSelection({ scope, kind: "payment" }) : undefined,
  };
}
