import type { OptimizeRouteResult } from "@/lib/route-optimizer/types";

export type OptimizerRequestStop = {
  /** Caller-owned key (e.g. appointment record id) returned in the stop-number map. */
  key: string;
  /** Address entry id sent to the optimizer. */
  addressId?: string;
  /** GeoJSON order: [longitude, latitude]. */
  coordinates?: readonly number[] | null;
};

function coordinatesKey(coordinates: readonly number[] | undefined | null): string {
  if (!coordinates || coordinates.length !== 2) return "";
  return `${coordinates[0].toFixed(6)},${coordinates[1].toFixed(6)}`;
}

function enqueue(queues: Map<string, string[]>, matchKey: string, key: string) {
  if (!matchKey) return;
  const queue = queues.get(matchKey);
  if (queue) {
    queue.push(key);
  } else {
    queues.set(matchKey, [key]);
  }
}

function takeUnassigned(
  queues: Map<string, string[]>,
  matchKey: string,
  assigned: ReadonlySet<string>,
): string | undefined {
  const queue = matchKey ? queues.get(matchKey) : undefined;
  while (queue?.length) {
    const candidate = queue.shift()!;
    if (!assigned.has(candidate)) return candidate;
  }
  return undefined;
}

/** Keys ordered by their current stop number; unnumbered keys are excluded. */
export function orderedStopKeys(stopNumbers: Readonly<Record<string, number>>): string[] {
  return Object.entries(stopNumbers)
    .sort(([, left], [, right]) => left - right)
    .map(([key]) => key);
}

/** 1-based stop numbers from an ordered key list. */
export function stopNumbersFromOrder(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key, index) => [key, index + 1]));
}

/**
 * Manually place one stop at a 1-based position and renumber the rest without
 * gaps. A null position removes the stop from the sequence. Positions past the
 * end append the stop.
 */
export function assignManualStopNumber(
  stopNumbers: Readonly<Record<string, number>>,
  key: string,
  position: number | null,
): Record<string, number> {
  const ordered = orderedStopKeys(stopNumbers).filter((existing) => existing !== key);

  if (position !== null && Number.isFinite(position)) {
    const index = Math.min(Math.max(Math.trunc(position) - 1, 0), ordered.length);
    ordered.splice(index, 0, key);
  }

  return stopNumbersFromOrder(ordered);
}

/**
 * Map optimized addresses back to request stops as 1-based stop numbers.
 * Several stops may share one address, so matches are consumed in request
 * order by address id, then by coordinates. Zero IDs are not identities;
 * repeated IDs with returned coordinates are resolved by location.
 */
export function assignOptimizedStopNumbers(
  stops: readonly OptimizerRequestStop[],
  result: OptimizeRouteResult,
): Record<string, number> {
  const byId = new Map<string, string[]>();
  const byCoordinates = new Map<string, string[]>();

  for (const stop of stops) {
    enqueue(byId, stop.addressId?.trim() ?? "", stop.key);
    enqueue(byCoordinates, coordinatesKey(stop.coordinates), stop.key);
  }

  const assigned = new Set<string>();
  const stopNumbers: Record<string, number> = {};
  const ambiguousIds = new Set(
    [...byId].filter(([, keys]) => keys.length > 1).map(([id]) => id),
  );

  for (const address of result.routes.flatMap((route) => route.addresses)) {
    // Legacy addresses (including depots) may all carry the zero ObjectID.
    // Repeated IDs with coordinates must match by location, not request order.
    const canMatchId =
      address.id !== "000000000000000000000000" &&
      (!ambiguousIds.has(address.id) || !address.coordinates);
    const key =
      (canMatchId ? takeUnassigned(byId, address.id, assigned) : undefined) ??
      takeUnassigned(byCoordinates, coordinatesKey(address.coordinates), assigned);
    if (!key) continue;

    assigned.add(key);
    stopNumbers[key] = assigned.size;
  }

  return stopNumbers;
}
