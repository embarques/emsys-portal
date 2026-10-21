import { z } from "zod";
import type { ParsedPlaceAddress } from "@/lib/customers/types";
import { isApiGeoLocation, type ApiGeoLocationPayload } from "@/lib/api/payloads";
import type { BranchAddress } from "@/lib/branches/types";

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

/** Both endpoints start at the branch address; coordinates stay blank when the branch has none. */
export function branchRouteEndpointDefaults(address: BranchAddress): RouteEndpointsFormValues {
  const text = [address.address1, address.city, address.state, address.zipcode, address.country]
    .filter((part) => part?.trim())
    .join(", ");
  const [longitude, latitude] = isApiGeoLocation(address.location)
    ? address.location.coordinates.map(String)
    : ["", ""];
  return {
    startAddress: text,
    endAddress: text,
    startLongitude: longitude,
    startLatitude: latitude,
    endLongitude: longitude,
    endLatitude: latitude,
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
