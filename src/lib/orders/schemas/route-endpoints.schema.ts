import { z } from "zod";
import type { ParsedPlaceAddress } from "@/lib/customers/types";
import type { ApiGeoLocationPayload } from "@/lib/api/payloads";

const coordinate = (limit: number) => z.string().trim().refine(
  (value) => value !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit,
);

export const routeEndpointsSchema = z.object({
  startAddress: z.string().trim().min(1),
  endAddress: z.string().trim().min(1),
  startLongitude: coordinate(180),
  startLatitude: coordinate(90),
  endLongitude: coordinate(180),
  endLatitude: coordinate(90),
});

export type RouteEndpointsFormValues = z.infer<typeof routeEndpointsSchema>;
export type RouteEndpointLocations = { start: ApiGeoLocationPayload; end: ApiGeoLocationPayload };

export function toRouteEndpointLocations(values: RouteEndpointsFormValues): RouteEndpointLocations {
  const parsed = routeEndpointsSchema.parse(values);
  return {
    start: { type: "Point", coordinates: [Number(parsed.startLongitude), Number(parsed.startLatitude)] },
    end: { type: "Point", coordinates: [Number(parsed.endLongitude), Number(parsed.endLatitude)] },
  };
}

/** Replace a resolved endpoint atomically; editing its text clears stale coordinates. */
export function routeEndpointFormFields(endpoint: "start" | "end", address: string, place?: ParsedPlaceAddress) {
  return {
    [`${endpoint}Address`]: address,
    [`${endpoint}Longitude`]: place?.location ? String(place.location.coordinates[0]) : "",
    [`${endpoint}Latitude`]: place?.location ? String(place.location.coordinates[1]) : "",
  } as Partial<RouteEndpointsFormValues>;
}
