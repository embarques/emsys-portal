"use client";

import { useMemo } from "react";
import {
  CircleAlert,
  FileText,
  Receipt,
  Send,
  UserCheck,
  Users,
} from "lucide-react";

import {
  DirectoryInsightsMetricsGrid,
  DirectoryInsightsShell,
  type DirectoryInsightMetric,
} from "@/components/app-shell/directory-insights-flip";
import { NewCustomersStatCard } from "@/components/customers/new-customers-stat-card";
import { NewInvoicesStatCard } from "@/components/invoices/new-invoices-stat-card";
import { AppointmentDirectoryInsights } from "@/components/orders/appointment-directory-insights";
import { useCustomerStats } from "@/lib/customers/hooks/use-customers";
import { formatInvoiceCount, formatInvoiceMoney } from "@/lib/invoices/display";
import { useInvoiceStats, useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { DEFAULT_INVOICE_LIST_PARAMS } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useOrderStats } from "@/lib/orders/hooks/use-orders";

export function DashboardAppointmentsStats() {
  const stats = useOrderStats();

  return (
    <AppointmentDirectoryInsights
      pendingTotal={stats.pending}
      pendingPickups={stats.pendingPickups}
      pendingTakes={stats.pendingTakes}
      pendingEstimates={stats.pendingEstimates}
      pendingPayments={stats.pendingPayments}
      isLoading={stats.isLoading}
    />
  );
}

export function DashboardInvoicesStats() {
  const { t } = useTranslation();
  const invoiceStats = useInvoiceStats();
  const totalQuery = useInvoices({ ...DEFAULT_INVOICE_LIST_PARAMS, limit: 1 });
  const totalInvoices = totalQuery.data?.total ?? 0;
  const isTotalLoading = totalQuery.isLoading;

  const metrics = useMemo<DirectoryInsightMetric[]>(
    () => [
      {
        label: t("invoices.stats.total.label"),
        value: isTotalLoading ? "…" : formatInvoiceCount(totalInvoices),
        description: t("invoices.stats.total.description"),
        icon: FileText,
      },
      {
        label: t("invoices.stats.outstandingCount.label"),
        value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
        description: t("invoices.stats.outstandingCount.description"),
        icon: CircleAlert,
      },
      {
        label: t("invoices.stats.outstandingBalance.label"),
        value: invoiceStats.isBalanceLoading
          ? "…"
          : formatInvoiceMoney(invoiceStats.outstandingBalance),
        description: t("invoices.stats.outstandingBalance.description"),
        icon: Receipt,
      },
    ],
    [
      invoiceStats.isBalanceLoading,
      invoiceStats.isLoading,
      invoiceStats.outstanding,
      invoiceStats.outstandingBalance,
      isTotalLoading,
      t,
      totalInvoices,
    ],
  );

  return (
    <DirectoryInsightsShell
      title={t("dashboard.invoices.title")}
      description={t("dashboard.invoices.insightsDescription")}
    >
      <div className="space-y-5">
        <NewInvoicesStatCard />
        <DirectoryInsightsMetricsGrid metrics={metrics} />
      </div>
    </DirectoryInsightsShell>
  );
}

export function DashboardCustomersStats() {
  const { t } = useTranslation();
  const stats = useCustomerStats();

  const metrics = useMemo<DirectoryInsightMetric[]>(
    () => [
      {
        label: t("customers.stats.total.label"),
        value: stats.isLoading ? "…" : stats.total.toLocaleString(),
        description: t("customers.stats.total.description"),
        icon: Users,
      },
      {
        label: t("customers.stats.senders.label"),
        value: stats.isLoading ? "…" : stats.senders.toLocaleString(),
        description: t("customers.stats.senders.description"),
        icon: Send,
      },
      {
        label: t("customers.stats.receivers.label"),
        value: stats.isLoading ? "…" : stats.receivers.toLocaleString(),
        description: t("customers.stats.receivers.description"),
        icon: UserCheck,
      },
    ],
    [stats.isLoading, stats.receivers, stats.senders, stats.total, t],
  );

  return (
    <DirectoryInsightsShell
      title={t("dashboard.clients.title")}
      description={t("dashboard.clients.insightsDescription")}
    >
      <div className="space-y-5">
        <NewCustomersStatCard />
        <DirectoryInsightsMetricsGrid metrics={metrics} />
      </div>
    </DirectoryInsightsShell>
  );
}
