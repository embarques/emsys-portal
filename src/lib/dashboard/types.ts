import type { MonthCounts, WeekdayCounts } from "@/lib/dashboard/histogram";

export type AppointmentDashboardMetrics = {
  timezone: string;
  createdByWeekday: WeekdayCounts;
  scheduledByWeekday: WeekdayCounts;
  scheduledByMonth: MonthCounts;
};

export type ClientDashboardMetrics = {
  timezone: string;
  createdByWeekday: WeekdayCounts;
  createdByMonth: MonthCounts;
};

export type InvoiceDashboardMetrics = {
  timezone: string;
  createdByWeekday: WeekdayCounts;
  createdByMonth: MonthCounts;
};
