import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  runSettledIdsWithConcurrency,
  type BulkSettledResult,
} from "@/lib/api/run-settled-with-concurrency";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  coerceTypedFilterNode,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import { VEHICLE_TABLE_FILTER_FIELDS } from "@/lib/vehicles/filter-fields";
import { VEHICLE_BAR_OR_SEARCH_FIELDS } from "@/lib/vehicles/search-fields";
import { buildApiBranchRef, type ApiBranchRefPayload } from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_VEHICLE_LIST_PARAMS,
  validateVehicleFormValues,
  type Vehicle,
  type VehicleBranch,
  type VehicleFormValues,
  type VehicleListParams,
} from "@/lib/vehicles/types";

function hasVehicleListFilters(params: VehicleListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: VEHICLE_TABLE_FILTER_FIELDS,
  });
}

const VEHICLE_NUMERIC_FIELDS: ReadonlySet<string> = new Set(["year", "branch.id"]);
const VEHICLE_BOOLEAN_FIELDS: ReadonlySet<string> = new Set(["active"]);

function buildVehicleSearchBody(params: VehicleListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_VEHICLE_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: VEHICLE_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: VEHICLE_TABLE_FILTER_FIELDS,
      expandNode: (node) =>
        coerceTypedFilterNode(node, {
          numericFields: VEHICLE_NUMERIC_FIELDS,
          booleanFields: VEHICLE_BOOLEAN_FIELDS,
        }),
    }),
  });
}

function buildVehiclesQuery(params: VehicleListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_VEHICLE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_VEHICLE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_VEHICLE_LIST_PARAMS.sort,
  });
}

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiBranchRef = {
  id?: number | string;
  code?: string;
};

type ApiVehicle = {
  id?: string;
  vehicleId?: string;
  name?: string;
  vin?: string;
  licensePlate?: string;
  year?: number;
  fuelType?: string;
  branch?: ApiBranchRef | string | null;
  active?: boolean;
  inspectionDate?: string;
  registrationDate?: string;
  createdAt?: string;
  createdBy?: ApiUser | string;
  updatedAt?: string;
};

/** POST/PUT /vehicles — Swagger vehicle payload */
type ApiVehicleWritePayload = {
  name: string;
  vin: string;
  year: number;
  fuelType: string;
  licensePlate?: string;
  vehicleId?: string;
  branch?: ApiBranchRefPayload;
  active: boolean;
  inspectionDate?: string;
  registrationDate?: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readStringId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id || undefined;
}

/** The API returns createdBy as a core.User object; surface a display name. */
function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

/** Reads a branch object (`{ id, code }`), falling back to a legacy string code. */
function normalizeVehicleBranch(raw: ApiVehicle["branch"]): VehicleBranch {
  if (raw && typeof raw === "object") {
    return {
      id: Number(raw.id ?? 0) || 0,
      code: String(raw.code ?? "").trim(),
    };
  }
  return { id: 0, code: String(raw ?? "").trim() };
}

function normalizeVehicle(raw: unknown): Vehicle | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiVehicle;
  const id = readStringId(item.id);
  if (!id) return null;

  return {
    id,
    vehicleId: String(item.vehicleId ?? "").trim(),
    name: String(item.name ?? "").trim(),
    vin: String(item.vin ?? "").trim().toUpperCase(),
    licensePlate: String(item.licensePlate ?? "").trim().toUpperCase(),
    year: Number(item.year ?? 0),
    fuelType: String(item.fuelType ?? "").trim(),
    branch: normalizeVehicleBranch(item.branch),
    active: item.active !== false,
    inspectionDate: String(item.inspectionDate ?? "").trim(),
    registrationDate: String(item.registrationDate ?? "").trim(),
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedVehicles(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Vehicle> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeVehicle).filter((vehicle): vehicle is Vehicle => vehicle != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildVehicleWritePayload(
  values: VehicleFormValues,
  options: { recordId?: string } = {},
): ApiVehicleWritePayload {
  validateVehicleFormValues(values);

  const yearValue = values.year.trim();
  const payload: ApiVehicleWritePayload = {
    name: values.name.trim(),
    vin: values.vin.trim().toUpperCase(),
    year: yearValue ? Number(yearValue) : 0,
    fuelType: values.fuelType.trim(),
    active: values.active,
  };

  const licensePlateValue = values.licensePlate.trim().toUpperCase();
  if (licensePlateValue) {
    payload.licensePlate = licensePlateValue;
  }

  // The vehicle code is assigned by the backend on create; only forward it when
  // an existing value is present (e.g. when editing a record).
  const vehicleIdValue = values.vehicleId.trim();
  if (vehicleIdValue) {
    payload.vehicleId = vehicleIdValue;
  }

  const branchCode = values.branch.code.trim();
  if (values.branch.id > 0 || branchCode) {
    payload.branch = buildApiBranchRef({ id: values.branch.id, code: branchCode });
  }

  const inspectionDateValue = values.inspectionDate.trim();
  if (inspectionDateValue) {
    payload.inspectionDate = inspectionDateValue;
  }

  const registrationDateValue = values.registrationDate.trim();
  if (registrationDateValue) {
    payload.registrationDate = registrationDateValue;
  }

  if (options.recordId) {
    payload.id = options.recordId;

    if (values.createdAt.trim()) {
      payload.createdAt = values.createdAt.trim();
    }

    // createdBy is a server-managed audit field (core.User on the backend).
    // We only hold its display name on the client, so we must not send it back
    // as a string — the API preserves the existing value on its own.

    payload.updatedAt = new Date().toISOString();
  }

  return payload;
}


function extractVehicleFromMutationResponse(data: unknown): Vehicle | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeVehicle(data);
  }
  return null;
}

function extractCreatedVehicleId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const vehicle = extractVehicleFromMutationResponse(data);
  return vehicle?.id ?? null;
}

function parseVehiclePathId(vehicleId: string): string {
  const id = vehicleId.trim();
  if (!id) {
    throw new Error("Invalid vehicle ID.");
  }
  return id;
}

async function resolveCreatedVehicle(
  values: VehicleFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Vehicle> {
  const createdId = extractCreatedVehicleId(response);
  if (createdId) {
    return fetchVehicleById(createdId);
  }

  const vehicle = extractVehicleFromMutationResponse(response.data);
  if (vehicle) {
    return vehicle;
  }

  const vehicleCode = values.vehicleId.trim();
  if (vehicleCode) {
    const matches = await fetchVehicles({
      page: 1,
      limit: 1,
      search: { field: "vehicleId", operator: "eq", value: vehicleCode },
    });

    const matchedVehicle = matches.items[0];
    if (matchedVehicle) {
      return matchedVehicle;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create vehicle.");
}

export async function fetchVehicles(params: VehicleListParams = {}): Promise<PaginatedResult<Vehicle>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.VEHICLES,
    page: params.page ?? DEFAULT_VEHICLE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_VEHICLE_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasVehicleListFilters(params),
    buildGetQuery: () => buildVehiclesQuery(params),
    buildSearchBody: () => buildVehicleSearchBody(params),
    normalize: normalizePaginatedVehicles,
  });
}

export async function fetchVehicleById(vehicleId: string): Promise<Vehicle> {
  const id = parseVehiclePathId(vehicleId);
  const response = await apiClient.get<ApiVehicle | PaginatedApiEnvelope<ApiVehicle>>(
    `${API_ENDPOINTS.VEHICLES}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiVehicle>).data
      : response;

  const vehicle = normalizeVehicle(raw);
  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  return vehicle;
}

export async function createVehicle(values: VehicleFormValues): Promise<Vehicle> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.VEHICLES,
    buildVehicleWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create vehicle.");

  return resolveCreatedVehicle(values, response);
}

export async function updateVehicle(vehicleId: string, values: VehicleFormValues): Promise<Vehicle> {
  const id = parseVehiclePathId(vehicleId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.VEHICLES}/${id}`,
    buildVehicleWritePayload(values, { recordId: id }),
  );

  assertMutationSuccess(response, "Unable to update vehicle.");

  const updatedVehicle = extractVehicleFromMutationResponse(response.data);
  if (updatedVehicle) {
    return updatedVehicle;
  }

  return fetchVehicleById(id);
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const id = parseVehiclePathId(vehicleId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.VEHICLES}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete vehicle.");
}

export async function deleteVehicles(vehicleIds: string[]): Promise<BulkSettledResult<string>> {
  const uniqueIds = [...new Set(vehicleIds.map((id) => id.trim()).filter(Boolean))];
  return runSettledIdsWithConcurrency(uniqueIds, deleteVehicle);
}
