import { parseRouteCities } from "@/lib/predefined-routes/utils/route-cities";

export const PREDEFINED_ROUTE_FILTER_FIELD = "predefinedRoute.id";
export function isRouteZipCode(entry: string): boolean { return /^\d{5}(?:-\d{4})?$/.test(entry.trim()); }
export function splitPredefinedRouteEntries(content: string): { cities: string[]; zips: string[] } {
  const entries = parseRouteCities(content);
  return { cities: entries.filter((entry) => !isRouteZipCode(entry)), zips: entries.filter(isRouteZipCode) };
}
