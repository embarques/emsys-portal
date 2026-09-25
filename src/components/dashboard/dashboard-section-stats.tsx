"use client";

import {
  ArrowDownToLine,
  CircleAlert,
  Clock,
  DollarSign,
  FileText,
  PackageOpen,
  Receipt,
  Send,
  UserCheck,
  Users,
} from "lucide-react";

import { FlippableStatCard } from "@/components/app-shell/flippable-stat-card";
import { StatCardsCarousel } from "@/components/app-shell/stat-cards-carousel";
import { NewCustomersStatCard } from "@/components/customers/new-customers-stat-card";
import { NewInvoicesStatCard } from "@/components/invoices/new-invoices-stat-card";
import { NewAppointmentsStatCard } from "@/components/orders/new-appointments-stat-card";
import { useCustomerStats } from "@/lib/customers/hooks/use-customers";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { useInvoiceStats, useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { DEFAULT_INVOICE_LIST_PARAMS } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useOrderStats } from "@/lib/orders/hooks/use-orders";

export function DashboardAppointmentsStats() {
  const { t } = useTranslation();
  const stats = useOrderStats();

  const cards = [
    {
      label: t("orders.stats.pendingOrders.label"),
      value: stats.pending.toString(),
      icon: Clock,
    },
    {
      label: t("orders.stats.pendingPickups.label"),
      value: stats.pendingPickups.toString(),
      icon: PackageOpen,
    },
    {
      label: t("orders.stats.pendingTakes.label"),
      value: stats.pendingTakes.toString(),
      icon: ArrowDownToLine,
    },
    {
      label: t("orders.stats.pendingEstimates.label"),
      value: stats.pendingEstimates.toString(),
      icon: FileText,
    },
    {
      label: t("orders.stats.pendingPayments.label"),
      value: stats.pendingPayments.toString(),
      icon: DollarSign,
    },
  ];

  return (
    <StatCardsCarousel>
      <NewAppointmentsStatCard />
      {cards.map((stat) => (
        <FlippableStatCard
          key={stat.label}
          label={stat.label}
          value={stats.isLoading ? "…" : stat.value}
          icon={stat.icon}
        />
      ))}
    </StatCardsCarousel>
  );
}

export function DashboardInvoicesStats() {
  const { t } = useTranslation();
  const invoiceStats = useInvoiceStats();
  const totalQuery = useInvoices({ ...DEFAULT_INVOICE_LIST_PARAMS, limit: 1 });
  const totalInvoices = totalQuery.data?.total ?? 0;
  const isTotalLoading = totalQuery.isLoading;

  const cards = [
    {
      label: t("invoices.stats.total.label"),
      value: isTotalLoading ? "…" : totalInvoices.toString(),
      description: t("invoices.stats.total.description"),
      icon: FileText,
    },
    {
      label: t("invoices.stats.outstandingCount.label"),
      value: invoiceStats.isLoading ? "…" : invoiceStats.outstanding.toString(),
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
  ];

  return (
    <StatCardsCarousel>
      <NewInvoicesStatCard />
      {cards.map((stat) => (
        <FlippableStatCard key={stat.label} {...stat} />
      ))}
    </StatCardsCarousel>
  );
}

export function DashboardCustomersStats() {
  const { t } = useTranslation();
  const stats = useCustomerStats();

  const cards = [
    {
      label: t("customers.stats.total.label"),
      value: stats.total,
      description: t("customers.stats.total.description"),
      icon: Users,
    },
    {
      label: t("customers.stats.senders.label"),
      value: stats.senders,
      description: t("customers.stats.senders.description"),
      icon: Send,
    },
    {
      label: t("customers.stats.receivers.label"),
      value: stats.receivers,
      description: t("customers.stats.receivers.description"),
      icon: UserCheck,
    },
  ];

  return (
    <StatCardsCarousel>
      <NewCustomersStatCard />
      {cards.map((stat) => (
        <FlippableStatCard
          key={stat.label}
          label={stat.label}
          value={stats.isLoading ? "…" : stat.value.toLocaleString()}
          description={stat.description}
          icon={stat.icon}
        />
      ))}
    </StatCardsCarousel>
  );
}
