import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { formatRouteCities, parseRouteCities } from "@/lib/predefined-routes/utils/route-cities";

/** Legacy-system route: a named, comma-separated list of the cities / ZIP codes it covers. */
export type PredefinedRoute = {
  id: number;
  name: string;
  content: string;
};

/** One editable row in the route form (a city or a ZIP code). */
export type PredefinedRouteCityEntry = { value: string };

export type PredefinedRouteFormValues = {
  name: string;
  cities: PredefinedRouteCityEntry[];
};

export type PredefinedRoutePayload = Pick<PredefinedRoute, "name" | "content">;

export function createEmptyPredefinedRouteCity(): PredefinedRouteCityEntry {
  return { value: "" };
}

export function createEmptyPredefinedRouteForm(): PredefinedRouteFormValues {
  return { name: "", cities: [createEmptyPredefinedRouteCity()] };
}

export function predefinedRouteToFormValues(route: PredefinedRoute): PredefinedRouteFormValues {
  const cities = parseRouteCities(route.content).map((value) => ({ value }));
  return { name: route.name, cities: cities.length ? cities : [createEmptyPredefinedRouteCity()] };
}

export function toPredefinedRoutePayload(values: PredefinedRouteFormValues): PredefinedRoutePayload {
  return {
    name: values.name.trim(),
    content: formatRouteCities(values.cities.map((entry) => entry.value)),
  };
}

export function arePredefinedRouteFormValuesEquivalent(
  left: PredefinedRouteFormValues,
  right: PredefinedRouteFormValues,
): boolean {
  return areFormValuesEquivalent(toPredefinedRoutePayload(left), toPredefinedRoutePayload(right));
}
