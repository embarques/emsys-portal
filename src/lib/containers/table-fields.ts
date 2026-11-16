import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["container.Container"]. */
export const CONTAINER_API_TABLE_FIELDS = [
  // Customs report configuration is not an additional directory column.
  { field: "receiverDocType", column: false },
  { field: "senderDocType", column: false },
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
