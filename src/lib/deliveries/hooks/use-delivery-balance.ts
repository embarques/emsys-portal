"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchInvoiceById } from "@/lib/invoices/api/invoices-api";
import { fetchCurrentUser } from "@/lib/users/api/users-api";
import { fetchEmployees } from "@/lib/employees/api/employees-api";
import { fetchActiveRoutes } from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api";
import { fetchChartAccounts } from "@/lib/accounting/chart-accounts/api/chart-accounts-api";
import { createDailyIncomeJournal, fetchAccountingPaymentMethods, fetchCurrentIncomeStatement } from "@/lib/accounting/daily-income/api";
import { useDuplicatePaymentConfirmation } from "@/lib/accounting/daily-income/use-duplicate-payment-confirmation";
import { DuplicatePaymentCancelledError, type JournalWriteOptions } from "@/lib/accounting/daily-income/duplicate-payment";
import { type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { store } from "@/lib/store/store";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import type { DeliverTarget, useDeliveryAccess } from "./use-deliver-invoice";
import { useDeliveryRouteRate } from "./use-delivery-route-rate";

export function useDeliveryBalance(target: DeliverTarget, access: ReturnType<typeof useDeliveryAccess>, active: boolean) {
  const { t } = useTranslation();
  const auth = useAuth();
  const client = useQueryClient();
  const has = (permission: { name: string; resourceType: string }) => auth.hasPermission(permission.name, permission.resourceType);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<"cleared" | "pending" | null>(null);
  const scope = ["delivery-balance", access.companyId, access.actorId, target.invoiceId];
  const rate = useDeliveryRouteRate(target);
  const invoice = useWorkspaceQuery({
    queryKey: scope,
    queryFn: ({ signal }) => fetchInvoiceById(target.invoiceId!, signal, true),
    enabled: access.canDeliver && Boolean(target.invoiceId),
    staleTime: 0,
  });
  // The API selects the current closeout; recording payments does not create periods.
  const canPay = access.canDeliver && access.canList && has(PERMISSIONS.incomeView) && has(PERMISSIONS.journalsCreate);
  const balance = invoice.isSuccess ? invoice.data.balance ?? null : null;
  const enabled = active && canPay && balance != null && balance !== 0;
  const profile = useWorkspaceQuery({ queryKey: [...scope, "profile"], queryFn: fetchCurrentUser, enabled });
  const branchId = profile.data?.branch.id ?? 0;
  const statement = useWorkspaceQuery({
    queryKey: [...scope, "statement", branchId],
    queryFn: ({ signal }) => fetchCurrentIncomeStatement(branchId, signal),
    enabled: enabled && branchId > 0,
  });
  const date = statement.data?.businessDate || statement.data?.date || "";
  const employees = useWorkspaceQuery({
    queryKey: [...scope, "employees"],
    queryFn: () => fetchEmployees({ page: 1, limit: 100, sort: "name:asc", active: true }),
    enabled: enabled && has(PERMISSIONS.employeesView),
  });
  const routes = useWorkspaceQuery({
    queryKey: [...scope, "routes", date],
    queryFn: () => fetchActiveRoutes({ page: 1, limit: 100, date }),
    enabled: enabled && Boolean(date) && has(PERMISSIONS.routesView),
  });
  const banks = useWorkspaceQuery({
    queryKey: [...scope, "banks"],
    queryFn: () => fetchChartAccounts({ page: 1, limit: 100, type: "BANK" }),
    enabled: enabled && has(PERMISSIONS.accountsView),
  });
  const methods = useWorkspaceQuery({ queryKey: [...scope, "methods"], queryFn: fetchAccountingPaymentMethods, enabled });
  const confirmation = useDuplicatePaymentConfirmation(active);



  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ values, options }: { values: DailyIncomeJournalValues; options?: JournalWriteOptions }) => {
      const session = store.getState().auth;
      if (!canPay || session.companyId !== access.companyId || statement.data?.status !== "OPEN") throw new Error(t("deliveries.wizard.balance.paymentUnavailable"));
      const fresh = await invoice.refetch();
      if (fresh.isError || !fresh.data || fresh.data.balance == null) throw new Error(t("deliveries.wizard.balance.loadError"));
      if (values.amount == null || !Number.isFinite(values.amount) || values.amount <= 0 || values.amount > fresh.data.balance) throw new Error(t("accounting.dailyIncome.form.validation.amountExceedsBalance"));
      const current = store.getState().auth;
      if (current.companyId !== session.companyId || current.idToken !== session.idToken) throw new Error(t("deliveries.wizard.balance.paymentUnavailable"));
      return createDailyIncomeJournal(statement.data, {
        ...values,
        transactionType: "PAYMENT",
        invoiceId: target.invoiceId!,
        invoiceNumber: fresh.data.invoiceNumber,
        invoiceBalance: fresh.data.balance,
      }, options);
    },
    onSuccess: async (_journal, { values }) => {
      if (store.getState().auth.companyId !== access.companyId) return;
      const clearingSegment = ({ CHECK: "checks", CHEQUE: "checks", ZELLE: "zelle-payments", DEPOSIT: "deposits", "CREDIT-CARD": "credit-card-payments" } as Record<string, string>)[values.paymentMethodName ?? ""];

      setRecorded("cleared");
      await Promise.all([
        invoice.refetch(),
        ...(clearingSegment ? [
          client.invalidateQueries({ queryKey: [...queryKeys.accounting.all, clearingSegment] }),
          client.invalidateQueries({ queryKey: queryKeys.accounting.clearablePaymentsOutstanding(clearingSegment) }),
        ] : []),
        client.invalidateQueries({ queryKey: queryKeys.invoices.detail(target.invoiceId!) }),
        client.invalidateQueries({ queryKey: queryKeys.deliveries.assigned() }),
        client.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        client.invalidateQueries({ queryKey: queryKeys.invoices.journals(target.invoiceId!, invoice.data?.invoiceNumber) }),
        client.invalidateQueries({ queryKey: queryKeys.invoices.stats("outstanding-balance") }),
        client.invalidateQueries({ queryKey: queryKeys.invoices.stats("outstanding") }),
        client.invalidateQueries({ queryKey: queryKeys.accounting.summaryTotals(statement.data!.id) }),
        client.invalidateQueries({ queryKey: queryKeys.accounting.incomeStatementById(statement.data!.id) }),
        client.invalidateQueries({ queryKey: queryKeys.accounting.incomeStatement(String(branchId), date) }),
        client.invalidateQueries({ queryKey: [...queryKeys.accounting.all, "journals"] }),
      ]);
    },
  });
  async function pay(values: DailyIncomeJournalValues) {
    setError(null);
    try {
      await confirmation.submit(values, async (snapshot, options) => { await mutation.mutateAsync({ values: snapshot, options }); });
    } catch (failure) {
      if (!(failure instanceof DuplicatePaymentCancelledError)) setError(normalizeApiError(failure).message);
    }
  }

  /** Only the authoritative invoice balance can permit delivery. */
  async function verify(): Promise<boolean> {
    const fresh = await invoice.refetch();
    return !fresh.isError && fresh.data?.balance === 0;
  }

  return {
    invoice, canPay, profile, statement, employees, routes, banks, methods, confirmation, pay, error, recorded,
    rate,
    ready: balance === 0,
    verify,
    creatingStatement: false,
    busy: confirmation.isSubmitting || mutation.isPending,
  };
}
