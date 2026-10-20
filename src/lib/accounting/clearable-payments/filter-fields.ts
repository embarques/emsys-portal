import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

/**
 * Advanced filters shared by POST /deposits, /zelle-payments and
 * /credit-card-payments search. The workspace relabels `paymentReference`
 * with the payment method's own reference label.
 *
 * Known API issue: `datePosted` filters are accepted but currently match no
 * records; they start working once the backend fix ships.
 */
export const CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "status",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "OUTSTANDING", label: "Outstanding" },
      { value: "CLEARED", label: "Cleared" },
    ],
  },
  {
    field: "paymentReference",
    label: "Payment reference",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter reference…",
  },
  {
    field: "invoice.number",
    label: "Invoice #",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter invoice number…",
  },
  {
    field: "refNumber",
    label: "Internal reference",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter internal reference…",
  },
  {
    field: "paymentAmount",
    label: "Amount",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "0.00",
  },
  {
    field: "datePosted",
    label: "Date posted",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "datePostedRange",
    label: "Date posted range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "clearedAt",
    label: "Cleared on",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "clearedAtRange",
    label: "Cleared range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "createdAt",
    label: "Created at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "createdAtRange",
    label: "Created at range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "createdBy.name",
    label: "Created by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter creator name…",
  },
  {
    field: "updatedBy.name",
    label: "Updated by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter updater name…",
  },
];

export const expandClearablePaymentFilterNode = createTypedFilterExpander({
  numericFields: ["paymentAmount"],
  rangeFields: { datePostedRange: "datePosted", clearedAtRange: "clearedAt", createdAtRange: "createdAt" },
});
