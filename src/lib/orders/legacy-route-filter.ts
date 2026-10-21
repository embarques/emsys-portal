import type { ApiSearchFilterNode } from "@/lib/api/search-query";
import type { LegacyRoute } from "@/lib/legacy-routes/types";
import { parseRouteCities } from "@/lib/legacy-routes/utils/route-cities";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-types";

/** Advanced filter row value: a legacy route id, expanded into the route's cities / ZIP codes. */
export const LEGACY_ROUTE_FILTER_FIELD = "legacyRoute.id";

const CITY_FIELD = "sender.address.city";
const ZIP_FIELD = "sender.address.zipcode";
const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;

export type LegacyRouteFilterLookup = ReadonlyMap<string, LegacyRoute>;

export function isRouteZipCode(entry: string): boolean {
  return ZIP_PATTERN.test(entry.trim());
}

function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase()}`);
}

/**
 * Pickup search compares text exactly, so case-insensitive city matching is sent as the
 * common spellings of each city (as entered, lower, UPPER and Title Case).
 */
export function cityCaseVariants(city: string): string[] {
  const trimmed = city.trim();
  if (!trimmed) return [];
  return [...new Set([trimmed, trimmed.toLocaleLowerCase(), trimmed.toLocaleUpperCase(), toTitleCase(trimmed)])];
}

export function splitLegacyRouteEntries(content: string): { cities: string[]; zips: string[] } {
  const cities: string[] = [];
  const zips: string[] = [];
  for (const entry of parseRouteCities(content)) {
    (isRouteZipCode(entry) ? zips : cities).push(entry);
  }
  return { cities, zips };
}

/**
 * `eq`: appointments whose sender city or ZIP is on the route.
 * `neq`: appointments whose sender city and ZIP are both off the route.
 */
export function buildLegacyRouteAddressFilter(route: LegacyRoute, operator: string): ApiSearchFilterNode {
  const { cities, zips } = splitLegacyRouteEntries(route.content);
  const negate = operator === "neq";
  const filters: ApiSearchFilterNode[] = [];
  const cityValues = cities.flatMap(cityCaseVariants);
  if (cityValues.length) filters.push({ field: CITY_FIELD, operator: negate ? "notIn" : "in", value: cityValues });
  if (zips.length) filters.push({ field: ZIP_FIELD, operator: negate ? "notIn" : "in", value: zips });
  if (!filters.length) {
    // A route without entries covers nothing: `eq` matches no appointment, `neq` matches all.
    filters.push({ field: ZIP_FIELD, operator: negate ? "notIn" : "in", value: [] });
  }
  return filters.length === 1 ? filters[0] : { operator: negate ? "and" : "or", filters };
}

/** Distinct legacy route ids referenced by complete advanced filter rows. */
export function collectLegacyRouteFilterIds(
  rows: readonly TableFilterRowState[] | undefined,
  fields: TableFilterFieldDefinition[],
): number[] {
  const ids = new Set<number>();
  for (const row of rows ?? []) {
    if (row.field !== LEGACY_ROUTE_FILTER_FIELD || !isCompleteFilterRow(row, fields)) continue;
    const id = Number(row.value.trim());
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid legacy route filter.");
    ids.add(id);
  }
  return [...ids];
}
