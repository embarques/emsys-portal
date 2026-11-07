import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;
const NUMBER_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;

/**
 * Bar search for POST /deliveries/assigned-barcodes/search. Only fields the API accepts:
 * one rejected leaf fails the whole search, so receiver address/phones wait on the backend.
 */
export const ASSIGNED_DELIVERY_BAR_OR_SEARCH_FIELDS = [
  "number",
  "invoice.number",
  "name",
  "container.name",
  "route.name",
  "sender.name",
  "sender.phones.number",
  "receiver.name",
  "receiver.address.city",
  "receiver.address.state",
] as const;

/** One advanced filter per Route Deliveries column (see docs/backend-api-gaps.md for pending fields). */
export const ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "number", label: "Barcode", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter barcode…" },
  { field: "invoice.number", label: "Invoice number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter invoice…" },
  { field: "invoice.balance", label: "Invoice balance", operators: [...NUMBER_OPERATORS], valueType: "text", placeholder: "Enter amount…" },
  { field: "route.rate", label: "Exchange rate (DOP/USD)", operators: [...NUMBER_OPERATORS], valueType: "text", placeholder: "Enter rate…" },
  { field: "name", label: "Name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "container.name", label: "Container", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter container…" },
  { field: "route.name", label: "Route", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter route…" },
  { field: "sender.name", label: "Sender name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter sender name…" },
  { field: "sender.phones.number", label: "Sender phones", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter phone…" },
  { field: "receiver.name", label: "Receiver name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter receiver…" },
  { field: "receiver.address.address1", label: "Address", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter address…" },
  { field: "receiver.address.state", label: "Province", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter province…" },
  { field: "receiver.address.city", label: "City", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter city…" },
  { field: "receiver.phones.number", label: "Receiver phones", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter phone…" },
];

export const expandAssignedDeliveryFilterNode = createTypedFilterExpander({
  numericFields: ["invoice.balance", "route.rate"],
});
