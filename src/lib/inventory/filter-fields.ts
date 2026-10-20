import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

/*
 * Advanced filters for the inventory directories (POST /inventory/<x>/search).
 * Only fields in the API allow-list are offered: `unitOfMeasure`, `currency`,
 * `defaultSellingPriceMinor`, supplier `addresses` / `contacts.*` and document
 * `notes` are rejected (400) by the search contract.
 */

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

const ACTIVE_FIELD: TableFilterFieldDefinition = {
  field: "isActive",
  label: "Status",
  operators: ["eq", "neq"],
  valueType: "select",
  options: [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ],
};

const DOCUMENT_STATUS_FIELD: TableFilterFieldDefinition = {
  field: "status",
  label: "Status",
  operators: ["eq", "neq"],
  valueType: "select",
  options: [
    { value: "DRAFT", label: "Draft" },
    { value: "POSTED", label: "Posted" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
};

function textField(field: string, label: string, placeholder: string): TableFilterFieldDefinition {
  return { field, label, operators: [...TEXT_OPERATORS], valueType: "text", placeholder };
}

function referenceField(field: string, label: string, optionsSource: string): TableFilterFieldDefinition {
  return { field, label, operators: ["eq", "neq"], valueType: "select", optionsSource };
}

function dateFields(field: string, label: string): TableFilterFieldDefinition[] {
  return [
    { field, label, operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
    {
      field: `${field}Range`,
      label: `${label} range`,
      operators: ["eq"],
      valueType: "range",
      placeholder: "2026-01-01 to 2026-06-30",
    },
  ];
}

/** `optionsSource` keys the workspaces fill with supplier / holder options. */
export const INVENTORY_FILTER_OPTION_SOURCES = {
  suppliers: "inventorySuppliers",
  holders: "inventoryHolders",
} as const;

export const INVENTORY_ITEM_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  textField("name", "Item", "Enter item name…"),
  textField("sku", "SKU", "Enter SKU…"),
  textField("category", "Category", "Enter category…"),
  {
    field: "reorderThreshold",
    label: "Reorder threshold",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "0",
  },
  ACTIVE_FIELD,
];

export const INVENTORY_RECEIPT_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  DOCUMENT_STATUS_FIELD,
  referenceField("supplierId", "Supplier", INVENTORY_FILTER_OPTION_SOURCES.suppliers),
  referenceField("toHolderId", "Warehouse", INVENTORY_FILTER_OPTION_SOURCES.holders),
  ...dateFields("receivedAt", "Received"),
];

export const INVENTORY_DISPATCH_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  DOCUMENT_STATUS_FIELD,
  referenceField("toHolderId", "Dispatched to", INVENTORY_FILTER_OPTION_SOURCES.holders),
  referenceField("fromHolderId", "From", INVENTORY_FILTER_OPTION_SOURCES.holders),
  ...dateFields("dispatchedAt", "Dispatched"),
];

export const INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  textField("companyName", "Company", "Enter company name…"),
  ACTIVE_FIELD,
];

export const INVENTORY_ITEM_FILTER_CONFIG = {
  fields: INVENTORY_ITEM_TABLE_FILTER_FIELDS,
  expandNode: createTypedFilterExpander({ numericFields: ["reorderThreshold"], booleanFields: ["isActive"] }),
};

export const INVENTORY_RECEIPT_FILTER_CONFIG = {
  fields: INVENTORY_RECEIPT_TABLE_FILTER_FIELDS,
  expandNode: createTypedFilterExpander({ rangeFields: { receivedAtRange: "receivedAt" } }),
};

export const INVENTORY_DISPATCH_FILTER_CONFIG = {
  fields: INVENTORY_DISPATCH_TABLE_FILTER_FIELDS,
  expandNode: createTypedFilterExpander({ rangeFields: { dispatchedAtRange: "dispatchedAt" } }),
};

export const INVENTORY_SUPPLIER_FILTER_CONFIG = {
  fields: INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS,
  expandNode: createTypedFilterExpander({ booleanFields: ["isActive"] }),
};

/** Labels select options from the existing inventory status catalogs. */
export function localizeInventoryFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
) {
  if (field === "isActive") {
    return { ...option, label: t(`inventory.activeStatuses.${option.value === "true" ? "active" : "inactive"}`) };
  }
  if (field === "status") {
    return { ...option, label: t(`inventory.documentStatuses.${option.value}`) };
  }
  return option;
}

/** Ids of records whose display name contains the query (accent/case-insensitive). */
export function matchReferenceIds<T>(records: readonly T[], query: string, getName: (record: T) => string, getId: (record: T) => string): string[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const needle = normalize(query);
  if (!needle) return [];
  return records.filter((record) => normalize(getName(record)).includes(needle)).map(getId).filter(Boolean);
}
