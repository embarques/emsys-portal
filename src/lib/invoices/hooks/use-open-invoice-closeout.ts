"use client";

import { useEffect, useRef } from "react";
import { useCreateIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeStatement } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";

/** The API selects the current date and branch; non-RD closeouts use USD at 1. */
export function useOpenInvoiceCloseout(branchId: number, onReady: (statement: DailyIncomeStatement) => void) {
  const { companyId, user, hasPermission } = useAuth();
  const create = useCreateIncomeStatement();
  const busy = useRef(false);
  const scope = `${companyId}:${user?.uid}:${branchId}`;
  const activeScope = useRef(scope);
  useEffect(() => {
    activeScope.current = scope;
    return () => { activeScope.current = ""; };
  }, [scope]);
  const canCreate = Boolean(companyId && branchId > 0 && hasPermission("canCreateIncomeStatement", "income_statement"));

  async function open() {
    if (busy.current || !canCreate) return;
    busy.current = true;
    try {
      // Only currency/rate are serialized by the central API adapter.
      const statement = await create.mutateAsync({ date: "", branchId, branchCode: "", branchName: "", currency: "USD", rate: 1 });
      if (activeScope.current === scope) onReady(statement);
    } catch {
      // Keep the invoice draft and display the mutation error for retry.
    } finally {
      busy.current = false;
    }
  }

  return { open, canCreate, isPending: create.isPending, error: create.isError ? normalizeApiError(create.error).message : null };
}
