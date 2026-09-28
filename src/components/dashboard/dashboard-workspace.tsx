"use client";

import { PageHeader } from "@/components/app-shell/page-header";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import {
  DashboardAppointmentsStats,
  DashboardCustomersStats,
  DashboardInvoicesStats,
} from "@/components/dashboard/dashboard-section-stats";
import {
  emptyMonthCounts,
  emptyWeekdayCounts,
  formatMonthLabels,
  formatWeekdayLabels,
  monthValues,
  weekdayValues,
} from "@/lib/dashboard/histogram";
import {
  useAppointmentDashboardMetrics,
  useClientDashboardMetrics,
  useInvoiceDashboardMetrics,
} from "@/lib/dashboard/hooks/use-dashboard-metrics";
import { useTranslation } from "@/lib/i18n";

export function DashboardWorkspace() {
  const { t, locale } = useTranslation();

  const appointments = useAppointmentDashboardMetrics();
  const clients = useClientDashboardMetrics();
  const invoices = useInvoiceDashboardMetrics();

  const weekdayLabels = formatWeekdayLabels(locale);
  const monthLabels = formatMonthLabels(locale);
  const allTimeLabel = t("dashboard.metrics.allTime");
  const errorLabel = t("dashboard.metrics.loadError");
  const retryLabel = t("dashboard.metrics.retry");
  const emptyLabel = t("dashboard.metrics.empty");

  const appointmentWeekdaySeries = [
    {
      key: "created",
      label: t("dashboard.appointments.weekday.created"),
      values: weekdayValues(appointments.data?.createdByWeekday ?? emptyWeekdayCounts()),
      colorClassName: "bg-blue-600 text-blue-600 dark:bg-blue-400 dark:text-blue-400",
    },
    {
      key: "scheduled",
      label: t("dashboard.appointments.weekday.scheduled"),
      values: weekdayValues(appointments.data?.scheduledByWeekday ?? emptyWeekdayCounts()),
      colorClassName: "bg-sky-400 text-sky-400 dark:bg-sky-300 dark:text-sky-300",
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("shell.dashboard.title")}
        description={t("shell.dashboard.description")}
      />

      <div className="space-y-10">
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">{t("dashboard.appointments.title")}</h3>
          <DashboardAppointmentsStats />
          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardChartCard
              title={t("dashboard.appointments.weekday.title")}
              description={t("dashboard.appointments.weekday.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void appointments.refetch()}
              emptyLabel={emptyLabel}
              categories={weekdayLabels}
              series={appointmentWeekdaySeries}
              isLoading={appointments.isPending || appointments.isFetching}
              isError={appointments.isError && !appointments.isFetching}
            />
            <DashboardChartCard
              variant="line"
              title={t("dashboard.appointments.month.title")}
              description={t("dashboard.appointments.month.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void appointments.refetch()}
              emptyLabel={emptyLabel}
              categories={monthLabels}
              series={[
                {
                  key: "scheduled",
                  label: t("dashboard.appointments.weekday.scheduled"),
                  values: monthValues(appointments.data?.scheduledByMonth ?? emptyMonthCounts()),
                  colorClassName: "bg-violet-600 text-violet-600 dark:bg-violet-400 dark:text-violet-400",
                },
              ]}
              isLoading={appointments.isPending || appointments.isFetching}
              isError={appointments.isError && !appointments.isFetching}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">{t("dashboard.invoices.title")}</h3>
          <DashboardInvoicesStats />
          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardChartCard
              variant="horizontal-bar"
              title={t("dashboard.invoices.weekday.title")}
              description={t("dashboard.invoices.weekday.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void invoices.refetch()}
              emptyLabel={emptyLabel}
              categories={weekdayLabels}
              series={[
                {
                  key: "created",
                  label: t("dashboard.invoices.title"),
                  values: weekdayValues(invoices.data?.createdByWeekday ?? emptyWeekdayCounts()),
                  colorClassName: "bg-teal-600 text-teal-600 dark:bg-teal-400 dark:text-teal-400",
                },
              ]}
              isLoading={invoices.isPending || invoices.isFetching}
              isError={invoices.isError && !invoices.isFetching}
            />
            <DashboardChartCard
              variant="area"
              title={t("dashboard.invoices.month.title")}
              description={t("dashboard.invoices.month.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void invoices.refetch()}
              emptyLabel={emptyLabel}
              categories={monthLabels}
              series={[
                {
                  key: "created",
                  label: t("dashboard.invoices.title"),
                  values: monthValues(invoices.data?.createdByMonth ?? emptyMonthCounts()),
                  colorClassName: "bg-amber-600 text-amber-600 dark:bg-amber-400 dark:text-amber-400",
                },
              ]}
              isLoading={invoices.isPending || invoices.isFetching}
              isError={invoices.isError && !invoices.isFetching}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold">{t("dashboard.clients.title")}</h3>
          <DashboardCustomersStats />
          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardChartCard
              variant="donut"
              title={t("dashboard.clients.weekday.title")}
              description={t("dashboard.clients.weekday.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void clients.refetch()}
              emptyLabel={emptyLabel}
              categories={weekdayLabels}
              series={[
                {
                  key: "created",
                  label: t("dashboard.clients.title"),
                  values: weekdayValues(clients.data?.createdByWeekday ?? emptyWeekdayCounts()),
                  colorClassName: "bg-rose-600 text-rose-600 dark:bg-rose-400 dark:text-rose-400",
                },
              ]}
              isLoading={clients.isPending || clients.isFetching}
              isError={clients.isError && !clients.isFetching}
            />
            <DashboardChartCard
              variant="line"
              title={t("dashboard.clients.month.title")}
              description={t("dashboard.clients.month.description")}
              allTimeLabel={allTimeLabel}
              errorLabel={errorLabel}
              retryLabel={retryLabel}
              onRetry={() => void clients.refetch()}
              emptyLabel={emptyLabel}
              categories={monthLabels}
              series={[
                {
                  key: "created",
                  label: t("dashboard.clients.title"),
                  values: monthValues(clients.data?.createdByMonth ?? emptyMonthCounts()),
                  colorClassName: "bg-indigo-600 text-indigo-600 dark:bg-indigo-400 dark:text-indigo-400",
                },
              ]}
              isLoading={clients.isPending || clients.isFetching}
              isError={clients.isError && !clients.isFetching}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
