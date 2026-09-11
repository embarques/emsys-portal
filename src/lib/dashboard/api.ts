import { monthCountsFromBuckets, weekdayCountsFromBuckets } from "@/lib/dashboard/histogram";
import type {
  AppointmentDashboardMetrics,
  ClientDashboardMetrics,
  InvoiceDashboardMetrics,
} from "@/lib/dashboard/types";
import type { InsightsHistogram } from "@/lib/insights/types";

export function toAppointmentDashboardMetrics(
  histogram: InsightsHistogram,
): AppointmentDashboardMetrics {
  return {
    timezone: histogram.timezone,
    createdByWeekday: weekdayCountsFromBuckets(histogram.createdByWeekday),
    scheduledByWeekday: weekdayCountsFromBuckets(histogram.scheduledByWeekday),
    scheduledByMonth: monthCountsFromBuckets(histogram.scheduledByMonth),
  };
}

export function toClientDashboardMetrics(histogram: InsightsHistogram): ClientDashboardMetrics {
  return {
    timezone: histogram.timezone,
    createdByWeekday: weekdayCountsFromBuckets(histogram.createdByWeekday),
    createdByMonth: monthCountsFromBuckets(histogram.createdByMonth),
  };
}

export function toInvoiceDashboardMetrics(histogram: InsightsHistogram): InvoiceDashboardMetrics {
  return {
    timezone: histogram.timezone,
    createdByWeekday: weekdayCountsFromBuckets(histogram.createdByWeekday),
    createdByMonth: monthCountsFromBuckets(histogram.createdByMonth),
  };
}
