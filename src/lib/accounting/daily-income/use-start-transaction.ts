"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { normalizeApiError } from "@/lib/api/api-error";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { isDeliveryBranchCode } from "@/lib/pickup-delivery-routes/types";
import { createTodayIncomeStatement, fetchCurrentIncomeStatement } from "./api";
import type { DailyIncomeStatement } from "./types";
import type { CloseoutSetupValues, TransactionBranch } from "./start-transaction";

export function useStartTransaction(branch: TransactionBranch | undefined, onReady: (statement: DailyIncomeStatement) => void) {
  const { companyId, user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const client = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const scope = `${companyId}:${user?.uid}:${branch?.id}`;
  const activeScope = useRef(scope);
  useEffect(() => {
    activeScope.current = scope;
    setSetupOpen(false);
    setError(null);
    return () => { activeScope.current = ""; };
  }, [scope]);
  const canStart = Boolean(companyId && branch && hasPermission("canCreateJournal", "journal") && hasPermission("canViewIncomeStatement", "income_statement"));
  const canCreate = hasPermission("canCreateIncomeStatement", "income_statement");

  const mutation = useMutation({
    mutationFn: async (setup?: CloseoutSetupValues) => {
      if (!canStart || !branch) throw new Error(t("accounting.dailyIncome.start.noPermission"));
      const currentKey = [...queryKeys.accounting.all, "current-closeout", companyId, branch.id];
      let current: DailyIncomeStatement | null = null;
      try {
        current = await client.fetchQuery({ queryKey: currentKey, queryFn: ({ signal }) => fetchCurrentIncomeStatement(branch.id, signal), staleTime: 0 });
      } catch (failure) {
        if (normalizeApiError(failure).status !== 404) throw failure;
      }
      if (activeScope.current !== scope) return null;
      if (current && current.branch?.id !== branch.id) throw new Error(t("accounting.dailyIncome.start.branchMismatch"));
      if (current?.status === "OPEN") return current;
      if (!canCreate) throw new Error(t("accounting.dailyIncome.start.noCreatePermission"));
      if (!setup && isDeliveryBranchCode(branch.code)) {
        setSetupOpen(true);
        return null;
      }
      const statement = await createTodayIncomeStatement(branch, setup ?? { currency: "USD", rate: 1 });
      if (activeScope.current !== scope) return null;
      client.setQueryData(currentKey, statement);
      client.setQueryData(queryKeys.accounting.incomeStatementById(statement.id), statement);
      await Promise.all([
        client.invalidateQueries({ queryKey: [...queryKeys.accounting.all, "income-statement", String(branch.id)] }),
        client.invalidateQueries({ queryKey: [...queryKeys.accounting.all, "open-income-statements", branch.id] }),
        ...(current ? [client.invalidateQueries({ queryKey: queryKeys.accounting.incomeStatementById(current.id) })] : []),
      ]);
      return statement;
    },
  });

  async function start(setup?: CloseoutSetupValues) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const statement = await mutation.mutateAsync(setup);
      if (statement && activeScope.current === scope) {
        setSetupOpen(false);
        onReady(statement);
      }
    } catch (failure) {
      if (activeScope.current === scope) setError(normalizeApiError(failure).message);
    } finally { busy.current = false; }
  }

  return { canStart, isPending: mutation.isPending, setupOpen, error, start, cancel: () => { if (!busy.current) { setSetupOpen(false); setError(null); } } };
}
