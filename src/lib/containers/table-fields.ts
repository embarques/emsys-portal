import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["container.Container"]. */
export const CONTAINER_API_TABLE_FIELDS = [
  { field: "arrivalDate", format: "date" },
  { field: "barcodeSequence" },
  { field: "booking" },
  { field: "broker" },
  { field: "company" },
  { field: "containerNumber" },
  { field: "cost" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "deliverySequence" },
  { field: "departureDate", format: "date" },
  { field: "id" },
  { field: "itn" },
  { field: "name", columnId: "container" },
  { field: "seal", columnId: "sealNumber" },
  { field: "sealNumber" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
