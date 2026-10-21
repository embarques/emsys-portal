import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { formatRouteCities, parseRouteCities } from "@/lib/legacy-routes/utils/route-cities";

/** Legacy-system route: a named, comma-separated list of the cities / ZIP codes it covers. */
export type LegacyRoute = {
  id: number;
  name: string;
  content: string;
};

/** One editable row in the route form (a city or a ZIP code). */
export type LegacyRouteCityEntry = { value: string };

export type LegacyRouteFormValues = {
  name: string;
  cities: LegacyRouteCityEntry[];
};

export type LegacyRoutePayload = Pick<LegacyRoute, "name" | "content">;

export function createEmptyLegacyRouteCity(): LegacyRouteCityEntry {
  return { value: "" };
}

export function createEmptyLegacyRouteForm(): LegacyRouteFormValues {
  return { name: "", cities: [createEmptyLegacyRouteCity()] };
}

export function legacyRouteToFormValues(route: LegacyRoute): LegacyRouteFormValues {
  const cities = parseRouteCities(route.content).map((value) => ({ value }));
  return { name: route.name, cities: cities.length ? cities : [createEmptyLegacyRouteCity()] };
}

export function toLegacyRoutePayload(values: LegacyRouteFormValues): LegacyRoutePayload {
  return {
    name: values.name.trim(),
    content: formatRouteCities(values.cities.map((entry) => entry.value)),
  };
}

export function areLegacyRouteFormValuesEquivalent(
  left: LegacyRouteFormValues,
  right: LegacyRouteFormValues,
): boolean {
  return areFormValuesEquivalent(toLegacyRoutePayload(left), toLegacyRoutePayload(right));
}
