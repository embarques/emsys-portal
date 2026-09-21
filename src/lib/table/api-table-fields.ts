import type { DataTableColumn } from "./types";

/** Top-level response fields displayed by a feature's directory table. */
export type ApiTableField = {
  field: string;
  /** Existing column that already represents this API field. */
  columnId?: string;
  format?: "date";
};

export type ApiTableRecord = {
  /** Read-only response values kept with the TanStack Query record, never sent in forms. */
  apiTableValues?: Readonly<Record<string, unknown>>;
};

const PRIVATE_FIELDS = /^(password|accessCode|token|accessToken|refreshToken|secret|apiKey)$/i;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !PRIVATE_FIELDS.test(key))
        .map(([key, entry]) => [key, sanitizeValue(entry)]),
    );
  }
  return value;
}

/**
 * Display label for API `updatedBy` / user refs.
 * Prefer `userName` (core.User) over dumping the whole actor object.
 */
export function readApiUserUsername(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value !== "object" || Array.isArray(value)) return "";

  const entry = value as Record<string, unknown>;
  const username = String(entry.userName ?? entry.username ?? "").trim();
  if (username) return username;

  const name = String(entry.name ?? entry.fullName ?? "").trim();
  if (name) return name;

  if (entry.id != null && entry.id !== "") return String(entry.id).trim();
  return "";
}

/** Preserve documented response fields that the feature's form model may omit. */
export function captureApiTableFields(raw: unknown, fields: readonly ApiTableField[]): ApiTableRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  return {
    apiTableValues: Object.fromEntries(
      fields
        .filter(({ field }) => Object.hasOwn(record, field) && !PRIVATE_FIELDS.test(field))
        .map(({ field }) => [field, sanitizeValue(record[field])]),
    ),
  };
}

function readField(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((entry, key) =>
    entry && typeof entry === "object" ? (entry as Record<string, unknown>)[key] : undefined,
  value);
}

export type ApiTableFormatters = {
  label: (field: string) => string;
  date: (value: string) => string;
  number: (value: number) => string;
  yes: string;
  no: string;
  empty: string;
};

/** Keep null distinct from false/zero, and render nested values as readable text. */
export function formatApiTableValue(value: unknown, formatters: ApiTableFormatters, field = ""): string {
  if (value == null || value === "") return formatters.empty;
  if (typeof value === "boolean") return value ? formatters.yes : formatters.no;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return formatters.empty;
    return /^(id|number)$|(?:Id|ID|Number)$/.test(field) ? String(value) : formatters.number(value);
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => formatApiTableValue(entry, formatters)).join("; ") || formatters.empty;
  }
  if (typeof value === "object") {
    // Updated-by columns must show the actor username, not the full user payload.
    if (field === "updatedBy") {
      return readApiUserUsername(value) || formatters.empty;
    }
    return Object.entries(value)
      .filter(([key, entry]) => !PRIVATE_FIELDS.test(key) && entry != null && entry !== "")
      .map(([key, entry]) => `${formatters.label(key)}: ${formatApiTableValue(entry, formatters, key)}`)
      .join(" · ") || formatters.empty;
  }
  return formatters.empty;
}

export function completeApiTableColumns<T extends ApiTableRecord>(
  columns: DataTableColumn<T>[],
  fields: readonly ApiTableField[],
  formatters: ApiTableFormatters,
): DataTableColumn<T>[] {
  const result = columns.map((column) => ({ ...column, defaultVisible: true }));
  const ids = new Set(columns.map((column) => column.id));
  for (const { field, columnId = field, format } of fields) {
    if (ids.has(columnId) || PRIVATE_FIELDS.test(field)) continue;
    ids.add(columnId);
    const renderValue = (row: T) => {
      const value = row.apiTableValues && Object.hasOwn(row.apiTableValues, field)
        ? row.apiTableValues[field]
        : readField(row, field);
      if (format === "date" && typeof value === "string" && value) return formatters.date(value);
      return formatApiTableValue(value, formatters, field);
    };
    result.push({
      id: columnId,
      label: formatters.label(field),
      defaultVisible: true,
      // The schema describes response fields, not server-supported sort paths.
      sortable: false,
      renderCell: renderValue,
      copyValue: renderValue,
    });
  }
  return result;
}
