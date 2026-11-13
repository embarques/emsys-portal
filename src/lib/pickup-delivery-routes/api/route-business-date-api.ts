import { z } from "zod";
import { translateCurrent } from "@/lib/i18n/translate-current";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertAssignableRouteDate } from "@/lib/pickup-delivery-routes/assignment-policy";

const routeBusinessDateSchema = z.object({
  businessDate: z.iso.date(),
  timezone: z.string().min(1),
  serverTime: z.iso.datetime({ offset: true }),
  nextMidnight: z.iso.datetime({ offset: true }),
}).refine(value => Date.parse(value.nextMidnight) > Date.parse(value.serverTime), "Expired route business date");
export type RouteBusinessDate = z.infer<typeof routeBusinessDateSchema>;

/** Available to assigned-only crews; no financial or branch-directory fetch is required. */
export async function fetchRouteBusinessDate(branchId?: number, signal?: AbortSignal): Promise<RouteBusinessDate> {
  const response = await apiClient.get<{ data: unknown }>(API_ENDPOINTS.VEHICLE_ROUTE_BUSINESS_DATE, {
    ...(branchId ? { params: { branchId } } : {}), signal,
  });
  return routeBusinessDateSchema.parse(response.data);
}

/** Uses elapsed time, so an operator's clock/timezone cannot shift the business day. */
export function routeBusinessDateLifetime(clock: RouteBusinessDate): number {
  return Date.parse(clock.nextMidnight) - Date.parse(clock.serverTime);
}

/** One server-clock read per assignment batch, rechecked after asynchronous work. */
export async function fetchRouteDateGuard(branchId?: number): Promise<(date: string) => void> {
  const clock = await fetchRouteBusinessDate(branchId);
  const started = performance.now();
  return date => {
    if (performance.now() - started >= routeBusinessDateLifetime(clock)) {
      throw new Error(translateCurrent("routes.errors.businessDateChanged"));
    }
    assertAssignableRouteDate(date, clock.businessDate);
  };
}
