"use client";

import { PageHeader } from "@/components/app-shell/page-header";
import {
  DashboardAppointmentsStats,
  DashboardCustomersStats,
  DashboardInvoicesStats,
} from "@/components/dashboard/dashboard-section-stats";
import { useTranslation } from "@/lib/i18n";

export function DashboardWorkspace() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t("shell.dashboard.title")}
        description={t("shell.dashboard.description")}
      />

      <div className="space-y-10">
        <DashboardAppointmentsStats />
        <DashboardInvoicesStats />
        <DashboardCustomersStats />
      </div>
    </div>
  );
}
