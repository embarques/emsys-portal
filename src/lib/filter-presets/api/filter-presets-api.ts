import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  buildAdvancedSearchBody,
  type BuildAdvancedSearchBodyOptions,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import type { TableFilterRowState } from "@/lib/table/filter-types";
import type { FilterPreset, FilterPresetWriteInput } from "@/lib/filter-presets/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeFilterRow(value: unknown): TableFilterRowState | null {
  const row = asRecord(value);
  if (!row) return null;

  const join = row.join === "or" ? "or" : "and";
  const id = String(row.id ?? "").trim();
  const field = String(row.field ?? "").trim();
  const operator = String(row.operator ?? "").trim();

  if (!id || !field || !operator) return null;

  return {
    id,
    join,
    field,
    operator,
    value: row.value == null ? "" : String(row.value),
  };
}

function normalizeFilterPreset(value: unknown): FilterPreset | null {
  const preset = asRecord(value);
  if (!preset) return null;

  const id = String(preset.id ?? "").trim();
  const name = String(preset.name ?? "").trim();
  if (!id || !name) return null;

  const rows = Array.isArray(preset.rows)
    ? preset.rows.map(normalizeFilterRow).filter((row): row is TableFilterRowState => row != null)
    : [];

  return {
    id,
    scope: String(preset.scope ?? "").trim(),
    name,
    rows,
    userId: preset.userId != null ? String(preset.userId) : undefined,
    createdAt: preset.createdAt != null ? String(preset.createdAt) : undefined,
    updatedAt: preset.updatedAt != null ? String(preset.updatedAt) : undefined,
  };
}

function extractList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const envelope = asRecord(payload);
  if (envelope && Array.isArray(envelope.data)) {
    return envelope.data as unknown[];
  }

  return [];
}

function extractRecord(payload: unknown): unknown {
  const envelope = asRecord(payload);
  if (envelope && "data" in envelope) {
    return envelope.data;
  }

  return payload;
}


function buildWritePayload(input: FilterPresetWriteInput): FilterPresetWriteInput {
  return {
    scope: input.scope.trim(),
    name: input.name.trim(),
    rows: input.rows.map((row) => ({ ...row })),
  };
}

/** GET /filter-presets — optionally scoped to a single workspace via `?scope=`. */
export async function fetchFilterPresets(scope?: string): Promise<FilterPreset[]> {
  const searchParams = new URLSearchParams();
  const trimmedScope = scope?.trim();
  if (trimmedScope) {
    searchParams.set("scope", trimmedScope);
  }

  const query = searchParams.toString();
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    query
      ? `${API_ENDPOINTS.FILTER_PRESETS}?${query}`
      : API_ENDPOINTS.FILTER_PRESETS,
  );

  return extractList(response)
    .map(normalizeFilterPreset)
    .filter((preset): preset is FilterPreset => preset != null);
}

/** POST /filter-presets/search — advanced search. */
export async function searchFilterPresets(
  options: BuildAdvancedSearchBodyOptions = {},
): Promise<FilterPreset[]> {
  const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.FILTER_PRESETS}/search`,
    buildAdvancedSearchBody(options),
  );

  return extractList(response)
    .map(normalizeFilterPreset)
    .filter((preset): preset is FilterPreset => preset != null);
}

/** GET /filter-presets/{id}. */
export async function fetchFilterPresetById(presetId: string): Promise<FilterPreset> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown>>(
    `${API_ENDPOINTS.FILTER_PRESETS}/${presetId}`,
  );

  const preset = normalizeFilterPreset(extractRecord(response));
  if (!preset) {
    throw new Error("Filter preset not found.");
  }

  return preset;
}

/** POST /filter-presets — `userId` is assigned server-side. */
export async function createFilterPreset(input: FilterPresetWriteInput): Promise<FilterPreset> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.FILTER_PRESETS,
    buildWritePayload(input),
  );

  assertMutationSuccess(response, "Unable to save filter preset.");

  const preset = normalizeFilterPreset(extractRecord(response));
  if (preset) return preset;

  throw new Error("Unable to save filter preset.");
}

/** PUT /filter-presets/{id} — the original owner is preserved server-side. */
export async function updateFilterPreset(
  presetId: string,
  input: FilterPresetWriteInput,
): Promise<FilterPreset> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.FILTER_PRESETS}/${presetId}`,
    buildWritePayload(input),
  );

  assertMutationSuccess(response, "Unable to update filter preset.");

  const preset = normalizeFilterPreset(extractRecord(response));
  return preset ?? fetchFilterPresetById(presetId);
}

/** DELETE /filter-presets/{id}. */
export async function deleteFilterPreset(presetId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.FILTER_PRESETS}/${presetId}`,
  );

  assertMutationSuccess(response, "Unable to delete filter preset.");
}
