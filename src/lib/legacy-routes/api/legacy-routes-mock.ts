import type { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { ApiSearchFilterNode, ApiSearchSortSpec, StripeStyleSearchBody } from "@/lib/api/search-query";
import type { LegacyRoute } from "@/lib/legacy-routes/types";

/**
 * Temporary stand-in for `/legacy-routes` until the API ships it.
 * Disable with `NEXT_PUBLIC_LEGACY_ROUTES_MOCK=false` to call the real endpoint.
 */
export function isLegacyRoutesMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK !== "false";
}

export type LegacyRoutesClient = Pick<typeof apiClient, "get" | "post" | "put" | "delete">;

export const LEGACY_ROUTES_MOCK_SEED: readonly LegacyRoute[] = [
  { id: 1, name: "Miami Norte", content: "Miami, North Miami, Miami Gardens, Opa-locka" },
  { id: 2, name: "Miami Sur", content: "Kendall, 33157, Cutler Bay, Homestead, 33030" },
  { id: 3, name: "Hialeah", content: "Hialeah, Hialeah Gardens, Miami Lakes, Medley" },
  { id: 4, name: "Doral / Westchester", content: "Doral, Sweetwater, Westchester, Fontainebleau" },
  { id: 5, name: "Broward", content: "Fort Lauderdale, Hollywood, Pembroke Pines, Miramar" },
  { id: 6, name: "Palm Beach", content: "West Palm Beach, Lake Worth, Boynton Beach, Delray Beach" },
  { id: 7, name: "Orlando", content: "Orlando, Kissimmee, Sanford, Altamonte Springs" },
  { id: 8, name: "Tampa Bay", content: "Tampa, St. Petersburg, Clearwater, Brandon" },
  { id: 9, name: "Bronx / Manhattan", content: "Bronx, Manhattan, Washington Heights, Inwood" },
  { id: 10, name: "Queens / Brooklyn", content: "Queens, Brooklyn, Corona, Jackson Heights" },
  { id: 11, name: "New Jersey Norte", content: "Paterson, Passaic, Union City, Jersey City" },
  { id: 12, name: "Massachusetts", content: "Boston, 02119, Lawrence, Lynn, Worcester" },
];

type Envelope = {
  success: boolean;
  message?: string;
  data?: unknown;
  page?: number;
  resultsPerPage?: number;
  total?: number;
};

type MockOptions = {
  seed?: readonly LegacyRoute[];
  /** Simulated network latency so loading states remain visible. */
  delayMs?: number;
};

const endpoint = API_ENDPOINTS.LEGACY_ROUTES;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return normalizeText(left).localeCompare(normalizeText(right));
}

function matchesLeaf(route: LegacyRoute, field: string, operator: string, value: unknown): boolean {
  const actual = (route as Record<string, unknown>)[field];
  if (actual === undefined) return false;
  const values = Array.isArray(value) ? value : [value];
  switch (operator) {
    case "contains":
      return normalizeText(actual).includes(normalizeText(value));
    case "startsWith":
      return normalizeText(actual).startsWith(normalizeText(value));
    case "eq":
      return compare(actual, value) === 0;
    case "neq":
      return compare(actual, value) !== 0;
    case "gt":
      return compare(actual, value) > 0;
    case "gte":
      return compare(actual, value) >= 0;
    case "lt":
      return compare(actual, value) < 0;
    case "lte":
      return compare(actual, value) <= 0;
    case "in":
      return values.some((candidate) => compare(actual, candidate) === 0);
    case "notIn":
      return values.every((candidate) => compare(actual, candidate) !== 0);
    default:
      return false;
  }
}

function matchesNode(route: LegacyRoute, node: ApiSearchFilterNode): boolean {
  if ("filters" in node) return matchesGroup(route, node.operator, node.filters);
  return matchesLeaf(route, node.field, node.operator, node.value);
}

function matchesGroup(route: LegacyRoute, operator: "and" | "or" | undefined, filters: ApiSearchFilterNode[] = []): boolean {
  if (!filters.length) return true;
  return operator === "or"
    ? filters.some((node) => matchesNode(route, node))
    : filters.every((node) => matchesNode(route, node));
}

function parseSortParam(sort: string | null): ApiSearchSortSpec[] {
  if (!sort) return [];
  return sort.split(",").map((part) => {
    const [field, direction] = part.split(":");
    return { field: field.trim(), direction: direction?.trim() === "desc" ? "desc" : "asc" };
  });
}

function sortRoutes(routes: LegacyRoute[], specs: ApiSearchSortSpec[]): LegacyRoute[] {
  const effective = specs.length ? specs : [{ field: "name", direction: "asc" as const }];
  return [...routes].sort((left, right) => {
    for (const spec of effective) {
      const result = compare(
        (left as Record<string, unknown>)[spec.field],
        (right as Record<string, unknown>)[spec.field],
      );
      if (result) return spec.direction === "desc" ? -result : result;
    }
    return left.id - right.id;
  });
}

function readRouteInput(data: unknown): Pick<LegacyRoute, "name" | "content"> | null {
  if (!data || typeof data !== "object") return null;
  const { name, content } = data as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || typeof content !== "string" || !content.trim()) return null;
  return { name, content };
}

/** In-memory `/legacy-routes` client with the same envelopes and search semantics as the API. */
export function createLegacyRoutesMockClient(options: MockOptions = {}): LegacyRoutesClient {
  let routes: LegacyRoute[] = (options.seed ?? LEGACY_ROUTES_MOCK_SEED).map((route) => ({ ...route }));
  const delayMs = options.delayMs ?? 0;

  function parseUrl(url: string) {
    const [path, query = ""] = url.split("?");
    if (path !== endpoint && !path.startsWith(`${endpoint}/`)) {
      throw new Error(`Legacy routes mock cannot handle ${url}`);
    }
    const rest = path.slice(endpoint.length).replace(/^\//, "");
    return { rest, params: new URLSearchParams(query) };
  }

  function page(items: LegacyRoute[], params: URLSearchParams): Envelope {
    const limit = Math.max(1, Number(params.get("limit")) || 40);
    const pageNumber = Math.max(1, Number(params.get("page")) || 1);
    const offset = params.has("offset") ? Math.max(0, Number(params.get("offset")) || 0) : (pageNumber - 1) * limit;
    const data = items.slice(offset, offset + limit);
    return { success: true, data, page: pageNumber, resultsPerPage: data.length, total: items.length };
  }

  function findIndex(rest: string): number {
    const id = Number(rest);
    return Number.isInteger(id) ? routes.findIndex((route) => route.id === id) : -1;
  }

  const notFound: Envelope = { success: false, message: "Legacy route not found." };
  const invalid: Envelope = { success: false, message: "Route name and cities are required." };

  function respond<T>(handler: () => Envelope): Promise<T> {
    return new Promise((resolve, reject) => {
      const settle = () => {
        try {
          resolve(structuredClone(handler()) as T);
        } catch (cause) {
          reject(cause);
        }
      };
      if (delayMs > 0) setTimeout(settle, delayMs);
      else settle();
    });
  }

  return {
    get: <T>(url: string) =>
      respond<T>(() => {
        const { rest, params } = parseUrl(url);
        if (!rest) return page(sortRoutes(routes, parseSortParam(params.get("sort"))), params);
        const index = findIndex(rest);
        return index < 0 ? notFound : { success: true, data: routes[index] };
      }),
    post: <T>(url: string, data?: unknown) =>
      respond<T>(() => {
        const { rest, params } = parseUrl(url);
        if (rest === "search") {
          const body = (data ?? {}) as StripeStyleSearchBody;
          const matches = routes.filter((route) => matchesGroup(route, body.operator, body.filters));
          return page(sortRoutes(matches, body.sort ?? []), params);
        }
        const input = readRouteInput(data);
        if (rest || !input) return invalid;
        const created = { id: routes.reduce((max, route) => Math.max(max, route.id), 0) + 1, ...input };
        routes = [...routes, created];
        return { success: true, data: created };
      }),
    put: <T>(url: string, data?: unknown) =>
      respond<T>(() => {
        const index = findIndex(parseUrl(url).rest);
        if (index < 0) return notFound;
        const input = readRouteInput(data);
        if (!input) return invalid;
        const updated = { ...routes[index], ...input };
        routes = routes.map((route, position) => (position === index ? updated : route));
        return { success: true, data: updated };
      }),
    delete: <T>(url: string) =>
      respond<T>(() => {
        const index = findIndex(parseUrl(url).rest);
        if (index < 0) return notFound;
        routes = routes.filter((_, position) => position !== index);
        return { success: true, data: null };
      }),
  };
}

let browserMockClient: LegacyRoutesClient | null = null;

/** Shared in-memory store for the session; resets on full page reload. */
export function getLegacyRoutesMockClient(): LegacyRoutesClient {
  browserMockClient ??= createLegacyRoutesMockClient({ delayMs: typeof window === "undefined" ? 0 : 250 });
  return browserMockClient;
}
