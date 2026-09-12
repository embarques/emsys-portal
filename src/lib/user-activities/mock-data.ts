import type { PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_USER_ACTIVITY_LIST_PARAMS,
  type UserActivity,
  type UserActivityListParams,
} from "@/lib/user-activities/types";

/**
 * Temporary mock until `GET/POST /user-activities` exists on the API.
 * Flip to `false` (or remove this module) when wiring the real endpoint.
 */
export const USE_USER_ACTIVITY_MOCK = true;

/** Realistic sample audit rows for Admin → User Activity. */
export const MOCK_USER_ACTIVITIES: UserActivity[] = [
  {
    activityId: "act_mock_001",
    timestamp: "2026-09-11T18:42:11.000Z",
    user: { id: "u_12", name: "Maria Lopez" },
    description: "Created invoice",
    origin: "invoice",
    entityId: "104582",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_002",
    timestamp: "2026-09-11T18:15:03.000Z",
    user: { id: "u_08", name: "Carlos Rivera" },
    description: "Posted payment of $250.00",
    origin: "payment",
    entityId: "88921",
    quantity: 250,
    severity: "uncommon",
  },
  {
    activityId: "act_mock_003",
    timestamp: "2026-09-11T17:58:44.000Z",
    user: { id: "u_03", name: "Ana Castillo" },
    description: "Updated barcode destination branch",
    origin: "barcode",
    entityId: "BC-778291",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_004",
    timestamp: "2026-09-11T16:30:00.000Z",
    user: { id: "u_01", name: "Admin User" },
    description: "Closed daily income statement",
    origin: "income_statement",
    entityId: "IS-2026-09-11",
    quantity: null,
    severity: "uncommon",
  },
  {
    activityId: "act_mock_005",
    timestamp: "2026-09-11T15:12:19.000Z",
    user: { id: "u_12", name: "Maria Lopez" },
    description: "Added comment on invoice",
    origin: "invoice",
    entityId: "104501",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_006",
    timestamp: "2026-09-11T14:05:55.000Z",
    user: { id: "u_15", name: "Luis Mendoza" },
    description: "Assigned invoice to container",
    origin: "container",
    entityId: "CNT-4412",
    quantity: 12,
    severity: "common",
  },
  {
    activityId: "act_mock_007",
    timestamp: "2026-09-10T22:41:08.000Z",
    user: { id: "u_01", name: "Admin User" },
    description: "Deleted customer contact",
    origin: "customer",
    entityId: "C-3920",
    quantity: null,
    severity: "rare",
  },
  {
    activityId: "act_mock_008",
    timestamp: "2026-09-10T20:18:33.000Z",
    user: { id: "u_08", name: "Carlos Rivera" },
    description: "Created appointment",
    origin: "appointment",
    entityId: "A-55201",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_009",
    timestamp: "2026-09-10T19:02:10.000Z",
    user: { id: "u_03", name: "Ana Castillo" },
    description: "Printed shipping labels",
    origin: "barcode",
    entityId: "104480",
    quantity: 8,
    severity: "common",
  },
  {
    activityId: "act_mock_010",
    timestamp: "2026-09-10T17:45:00.000Z",
    user: { id: "u_01", name: "Admin User" },
    description: "Reopened daily income statement",
    origin: "income_statement",
    entityId: "IS-2026-09-09",
    quantity: null,
    severity: "rare",
  },
  {
    activityId: "act_mock_011",
    timestamp: "2026-09-10T16:11:27.000Z",
    user: { id: "u_15", name: "Luis Mendoza" },
    description: "Updated vehicle route assignment",
    origin: "vehicle",
    entityId: "VH-17",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_012",
    timestamp: "2026-09-10T14:33:51.000Z",
    user: { id: "u_12", name: "Maria Lopez" },
    description: "Created customer",
    origin: "customer",
    entityId: "C-4102",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_013",
    timestamp: "2026-09-09T23:08:14.000Z",
    user: { id: "u_08", name: "Carlos Rivera" },
    description: "Voided payment",
    origin: "payment",
    entityId: "88710",
    quantity: 75,
    severity: "rare",
  },
  {
    activityId: "act_mock_014",
    timestamp: "2026-09-09T21:50:02.000Z",
    user: { id: "u_03", name: "Ana Castillo" },
    description: "Updated invoice merchandise description",
    origin: "invoice",
    entityId: "104390",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_015",
    timestamp: "2026-09-09T18:22:40.000Z",
    user: { id: "u_15", name: "Luis Mendoza" },
    description: "Marked container as departed",
    origin: "container",
    entityId: "CNT-4398",
    quantity: null,
    severity: "uncommon",
  },
  {
    activityId: "act_mock_016",
    timestamp: "2026-09-09T15:05:18.000Z",
    user: { id: "u_12", name: "Maria Lopez" },
    description: "Generated pickup manifest report",
    origin: "report",
    entityId: "RPT-8821",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_017",
    timestamp: "2026-09-08T20:40:00.000Z",
    user: { id: "u_01", name: "Admin User" },
    description: "Updated role permissions",
    origin: "role",
    entityId: "role_ops",
    quantity: null,
    severity: "uncommon",
  },
  {
    activityId: "act_mock_018",
    timestamp: "2026-09-08T19:14:36.000Z",
    user: { id: "u_08", name: "Carlos Rivera" },
    description: "Scheduled delivery appointment",
    origin: "appointment",
    entityId: "A-55188",
    quantity: null,
    severity: "common",
  },
  {
    activityId: "act_mock_019",
    timestamp: "2026-09-08T16:55:09.000Z",
    user: { id: "u_03", name: "Ana Castillo" },
    description: "Decreased barcode quantity on invoice",
    origin: "invoice",
    entityId: "104210",
    quantity: 3,
    severity: "uncommon",
  },
  {
    activityId: "act_mock_020",
    timestamp: "2026-09-08T13:28:47.000Z",
    user: { id: "u_15", name: "Luis Mendoza" },
    description: "Created inventory supply request",
    origin: "inventory",
    entityId: "INV-992",
    quantity: 24,
    severity: "common",
  },
];

function parseSort(sort: UserActivityListParams["sort"]): {
  field: string;
  direction: "asc" | "desc";
} {
  const raw =
    typeof sort === "string"
      ? sort
      : Array.isArray(sort)
        ? `${sort[0]?.field ?? ""}:${sort[0]?.direction ?? "desc"}`
        : sort
          ? `${sort.field}:${sort.direction ?? "desc"}`
          : DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort;

  const [fieldPart, directionPart] = raw.split(":");
  const field = fieldPart?.trim() || "timestamp";
  const direction = directionPart?.trim().toLowerCase() === "asc" ? "asc" : "desc";
  return { field, direction };
}

function readSortableValue(row: UserActivity, field: string): string | number {
  switch (field) {
    case "timestamp":
      return row.timestamp;
    case "user":
    case "user.name":
      return row.user.name.toLowerCase();
    case "description":
      return row.description.toLowerCase();
    case "origin":
      return row.origin.toLowerCase();
    case "id":
    case "entityId":
      return row.entityId.toLowerCase();
    case "quantity":
      return row.quantity ?? Number.NEGATIVE_INFINITY;
    case "severity":
      return row.severity;
    default:
      return row.timestamp;
  }
}

function matchesSearch(row: UserActivity, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    row.description,
    row.origin,
    row.entityId,
    row.user.name,
    row.severity,
    row.activityId,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

/** Client-side list/search/paginate for the temporary mock catalog. */
export async function fetchMockUserActivities(
  params: UserActivityListParams = {},
): Promise<PaginatedResult<UserActivity>> {
  const page = params.page ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.limit;
  const query = params.search?.value ?? "";
  const { field, direction } = parseSort(params.sort ?? DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort);

  const filtered = MOCK_USER_ACTIVITIES.filter((row) => matchesSearch(row, query));

  const sorted = [...filtered].sort((a, b) => {
    const left = readSortableValue(a, field);
    const right = readSortableValue(b, field);
    if (left < right) return direction === "asc" ? -1 : 1;
    if (left > right) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const start = Math.max(0, (page - 1) * limit);
  const items = sorted.slice(start, start + limit);

  // Small delay so the directory loading/fetching states still feel real.
  await new Promise((resolve) => setTimeout(resolve, 180));

  return {
    items,
    total: filtered.length,
    page,
    resultsPerPage: limit,
  };
}
