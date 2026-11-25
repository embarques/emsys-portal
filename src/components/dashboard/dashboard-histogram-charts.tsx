"use client";

import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
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

/** Keep each metric's color consistent across weekday and month charts. */
const chartColors = {
  appointmentsCreated: "bg-blue-700 text-blue-700 dark:bg-blue-400 dark:text-blue-400",
  appointmentsScheduled: "bg-cyan-600 text-cyan-600 dark:bg-cyan-300 dark:text-cyan-300",
  invoicesCreated: "bg-teal-600 text-teal-600 dark:bg-teal-400 dark:text-teal-400",
  clientsCreated: "bg-violet-600 text-violet-600 dark:bg-violet-400 dark:text-violet-400",
};

function useDashboardChartCopy() {
  const { t, locale } = useTranslation();
  return {
    weekdayLabels: formatWeekdayLabels(locale),
    monthLabels: formatMonthLabels(locale),
    allTimeLabel: t("dashboard.metrics.allTime"),
    errorLabel: t("dashboard.metrics.loadError"),
    retryLabel: t("dashboard.metrics.retry"),
    emptyLabel: t("dashboard.metrics.empty"),
    t,
  };
}

/** All-time appointment weekday + month scheduled charts. */
export function AppointmentHistogramCharts() {
  const appointments = useAppointmentDashboardMetrics();
  const { weekdayLabels, monthLabels, allTimeLabel, errorLabel, retryLabel, emptyLabel, t } =
    useDashboardChartCopy();

  const appointmentWeekdaySeries = [
    {
      key: "created",
      label: t("dashboard.appointments.weekday.created"),
      values: weekdayValues(appointments.data?.createdByWeekday ?? emptyWeekdayCounts()),
      colorClassName: chartColors.appointmentsCreated,
    },
    {
      key: "scheduled",
      label: t("dashboard.appointments.weekday.scheduled"),
      values: weekdayValues(appointments.data?.scheduledByWeekday ?? emptyWeekdayCounts()),
      colorClassName: chartColors.appointmentsScheduled,
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DashboardChartCard
        variant="line"
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
            colorClassName: chartColors.appointmentsScheduled,
          },
        ]}
        isLoading={appointments.isPending || appointments.isFetching}
        isError={appointments.isError && !appointments.isFetching}
      />
    </div>
  );
}

/** All-time invoice weekday + month created charts. */
export function InvoiceHistogramCharts() {
  const invoices = useInvoiceDashboardMetrics();
  const { weekdayLabels, monthLabels, allTimeLabel, errorLabel, retryLabel, emptyLabel, t } =
    useDashboardChartCopy();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DashboardChartCard
        variant="line"
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
            colorClassName: chartColors.invoicesCreated,
          },
        ]}
        isLoading={invoices.isPending || invoices.isFetching}
        isError={invoices.isError && !invoices.isFetching}
      />
      <DashboardChartCard
        variant="line"
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
            colorClassName: chartColors.invoicesCreated,
          },
        ]}
        isLoading={invoices.isPending || invoices.isFetching}
        isError={invoices.isError && !invoices.isFetching}
      />
    </div>
  );
}

/** All-time client weekday + month created charts. */
export function ClientHistogramCharts() {
  const clients = useClientDashboardMetrics();
  const { weekdayLabels, monthLabels, allTimeLabel, errorLabel, retryLabel, emptyLabel, t } =
    useDashboardChartCopy();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DashboardChartCard
        variant="line"
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
            colorClassName: chartColors.clientsCreated,
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
            colorClassName: chartColors.clientsCreated,
          },
        ]}
        isLoading={clients.isPending || clients.isFetching}
        isError={clients.isError && !clients.isFetching}
      />
    </div>
  );
}
