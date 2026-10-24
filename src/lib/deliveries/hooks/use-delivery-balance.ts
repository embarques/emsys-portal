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
import { createDailyIncomeJournal, createIncomeStatement, fetchAccountingPaymentMethods, searchIncomeStatementForDate } from "@/lib/accounting/daily-income/api";
import { useDuplicatePaymentConfirmation } from "@/lib/accounting/daily-income/use-duplicate-payment-confirmation";
import { DuplicatePaymentCancelledError, type JournalWriteOptions } from "@/lib/accounting/daily-income/duplicate-payment";
import { toApiPaymentMethodName, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import {
  fetchInvoicePendingPayments,
  sumPendingPayments,
  type PendingPaymentMethod,
} from "@/lib/deliveries/api/delivery-pending-payments-api";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { store } from "@/lib/store/store";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import type { DeliverTarget, useDeliveryAccess } from "./use-deliver-invoice";
import { useDeliveryRouteRate } from "./use-delivery-route-rate";

const PENDING_LIST_PERMISSIONS = {
  CHECK: PERMISSIONS.checksList,
  ZELLE: PERMISSIONS.zellePaymentsList,
  DEPOSIT: PERMISSIONS.depositsList,
  "CREDIT-CARD": PERMISSIONS.creditCardPaymentsList,
} as const satisfies Record<PendingPaymentMethod, unknown>;

/** Pending payments cover the balance when they are at least the balance, to the cent. */
function covers(pending: number, balance: number): boolean {
  return Math.round(pending * 100) >= Math.round(balance * 100);
}

export function useDeliveryBalance(target: DeliverTarget, access: ReturnType<typeof useDeliveryAccess>, active: boolean) {
  const { t } = useTranslation();
  const auth = useAuth();
  const client = useQueryClient();
  const has = (permission: { name: string; resourceType: string }) => auth.hasPermission(permission.name, permission.resourceType);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<"cleared" | "pending" | null>(null);
  const [overrideAccepted, setOverrideAccepted] = useState(false);
  const scope = ["delivery-balance", access.companyId, access.actorId, target.invoiceId];
  const rate = useDeliveryRouteRate(target);
  const invoice = useWorkspaceQuery({
    queryKey: scope,
    queryFn: ({ signal }) => fetchInvoiceById(target.invoiceId!, signal, true),
    enabled: access.canDeliver && Boolean(target.invoiceId),
    staleTime: 0,
  });
  // Recording payment, opening a Cuadre and overriding clearance share one gate.
  const canPay = access.canDeliver && access.canList && has(PERMISSIONS.incomeStatementsCreate) && has(PERMISSIONS.journalsCreate);
  const balance = invoice.isSuccess ? invoice.data.balance ?? null : null;
  const enabled = active && canPay && balance != null && balance !== 0;
  const profile = useWorkspaceQuery({ queryKey: [...scope, "profile"], queryFn: fetchCurrentUser, enabled });
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const branchId = profile.data?.branch.id ?? 0;
  const statement = useWorkspaceQuery({
    queryKey: [...scope, "statement", branchId, date],
    queryFn: () => searchIncomeStatementForDate(branchId, date),
    enabled: enabled && branchId > 0,
  });
  const employees = useWorkspaceQuery({
    queryKey: [...scope, "employees"],
    queryFn: () => fetchEmployees({ page: 1, limit: 100, sort: "name:asc", active: true }),
    enabled: enabled && has(PERMISSIONS.employeesView),
  });
  const routes = useWorkspaceQuery({
    queryKey: [...scope, "routes", date],
    queryFn: () => fetchActiveRoutes({ page: 1, limit: 100, date }),
    enabled: enabled && has(PERMISSIONS.routesView),
  });
  const banks = useWorkspaceQuery({
    queryKey: [...scope, "banks"],
    queryFn: () => fetchChartAccounts({ page: 1, limit: 100, type: "BANK" }),
    enabled: enabled && has(PERMISSIONS.accountsView),
  });
  const methods = useWorkspaceQuery({ queryKey: [...scope, "methods"], queryFn: fetchAccountingPaymentMethods, enabled });
  const pendingMethods = (Object.keys(PENDING_LIST_PERMISSIONS) as PendingPaymentMethod[])
    .filter((method) => has(PENDING_LIST_PERMISSIONS[method]));
  const pendingKey = (invoiceNumber: string) => [...scope, "pending-payments", invoiceNumber, pendingMethods.join(",")];
  const fetchPending = (invoiceNumber: string) =>
    fetchInvoicePendingPayments({ invoiceId: target.invoiceId!, invoiceNumber }, pendingMethods);
  const invoiceNumber = invoice.data?.invoiceNumber ?? "";
  const pending = useWorkspaceQuery({
    queryKey: pendingKey(invoiceNumber),
    queryFn: () => fetchPending(invoiceNumber),
    enabled: enabled && balance! > 0 && Boolean(invoiceNumber) && pendingMethods.length > 0,
    staleTime: 0,
  });
  const pendingTotal = sumPendingPayments(pending.data ?? []);
  const canOverride = canPay && balance != null && balance > 0 && pending.isSuccess && pendingTotal > 0 && covers(pendingTotal, balance);
  const overridden = overrideAccepted && canOverride;
  const confirmation = useDuplicatePaymentConfirmation(active);

  const createStatement = useMutation({
    retry: false,
    mutationFn: async () => {
      const branch = profile.data?.branch;
      if (!canPay || !branch?.id || rate == null || store.getState().auth.companyId !== access.companyId)
        throw new Error(t("deliveries.wizard.balance.paymentUnavailable"));
      return createIncomeStatement({ date, branchId: branch.id, branchCode: "", branchName: branch.name ?? "", currency: "USD", rate });
    },
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        statement.refetch(),
        client.invalidateQueries({ queryKey: queryKeys.accounting.all }),
      ]);
    },
    onError: (failure) => setError(normalizeApiError(failure).message),
  });

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
      const nonCash = toApiPaymentMethodName(values.paymentMethodName) !== "CASH";

      setRecorded(nonCash && !values.autoClear ? "pending" : "cleared");
      await Promise.all([
        invoice.refetch(),
        ...(nonCash && pendingMethods.length > 0 ? [pending.refetch()] : []),
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

  /**
   * Rereads the authoritative balance. Passes at zero, or when the driver accepted
   * liability and outstanding non-cash payments still cover the balance.
   */
  async function verify(): Promise<boolean> {
    const fresh = await invoice.refetch();
    if (fresh.isError || !fresh.data || fresh.data.balance == null) return false;
    if (fresh.data.balance === 0) return true;
    if (!overrideAccepted || !canPay || fresh.data.balance < 0 || pendingMethods.length === 0) return false;
    try {
      const number = fresh.data.invoiceNumber;
      const payments = await client.fetchQuery({ queryKey: pendingKey(number), queryFn: () => fetchPending(number), staleTime: 0 });
      return covers(sumPendingPayments(payments), fresh.data.balance);
    } catch {
      return false;
    }
  }

  return {
    invoice, canPay, profile, statement, employees, routes, banks, methods, confirmation, pay, error, recorded,
    rate, pending, pendingTotal, canOverride, overridden,
    overrideAccepted, setOverrideAccepted,
    ready: balance === 0 || overridden,
    verify,
    createStatement: () => createStatement.mutate(),
    creatingStatement: createStatement.isPending,
    busy: confirmation.isSubmitting || mutation.isPending || createStatement.isPending,
  };
}
