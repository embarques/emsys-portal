import type { MonthCounts, WeekdayCounts } from "@/lib/dashboard/histogram";

export type DashboardScanMeta = {
  scanned: number;
  total: number;
  truncated: boolean;
};

export type AppointmentDashboardMetrics = DashboardScanMeta & {
  createdByWeekday: WeekdayCounts;
  scheduledByWeekday: WeekdayCounts;
  scheduledByMonth: MonthCounts;
};

export type ClientDashboardMetrics = DashboardScanMeta & {
  createdByWeekday: WeekdayCounts;
  createdByMonth: MonthCounts;
};

export type InvoiceDashboardMetrics = DashboardScanMeta & {
  createdByWeekday: WeekdayCounts;
  createdByMonth: MonthCounts;
};
