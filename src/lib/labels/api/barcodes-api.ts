import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import { fetchInvoiceById } from "@/lib/invoices/api/invoices-api";
import type { InvoiceLineItem, InvoiceLineItemBarcode } from "@/lib/invoices/types";
import {
  NEW_BARCODE_STATUS,
  type Barcode,
  type GeneratedLabel,
  type GeneratedLabelSource,
} from "@/lib/labels/types";

type ApiBarcodeStatus = {
  id?: number;
  name?: string;
  prevStatus?: string;
};

type ApiBarcodeContainer = {
  id?: number | string;
  name?: string;
};

type ApiBarcode = {
  id?: number | string;
  number?: string;
  status?: ApiBarcodeStatus;
  container?: ApiBarcodeContainer;
  scanDate?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** Payload accepted by `POST /barcodes` and `PUT /barcodes/{id}`. */
export type BarcodeWritePayload = {
  number: string;
  status: { id: number; name: string };
  container?: { id: number; name: string };
  delivery?: { id: number; name: string };
};

/** One selected invoice line item to generate (or retrieve) labels for. */
export type GenerateLabelTarget = {
  invoiceId: string;
  lineItemId: string;
};

/** Result of assigning invoice-item barcodes to a route. */
export type InvoiceItemBarcodeRoute = {
  routeId: string;
  routeName: string;
  tripNumber: number;
  assignedCount: number;
};

type ApiBarcodeRouteData = {
  route?: { id?: string; name?: string };
  tripNumber?: number;
  assignedCount?: number;
};

/** A single barcode update to apply via `PUT /barcodes/{id}`. */
export type BarcodeUpdate = {
  id: number;
  payload: BarcodeWritePayload;
};

function readNumericId(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeBarcode(raw: unknown): Barcode | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiBarcode;
  const number = String(item.number ?? "").trim();
  const id = readNumericId(item.id) ?? 0;
  if (!number && id <= 0) return null;

  const statusName = String(item.status?.name ?? "").trim();
  const containerName = String(item.container?.name ?? "").trim();

  return {
    id,
    number,
    status: statusName ? { id: item.status?.id, name: statusName } : null,
    container: containerName
      ? { id: readNumericId(item.container?.id), name: containerName }
      : null,
    scanDate: String(item.scanDate ?? "").trim() || undefined,
  };
}

function unwrapEnvelope(response: unknown): unknown {
  if (response && typeof response === "object" && "data" in response) {
    return (response as PaginatedApiEnvelope<unknown>).data;
  }
  return response;
}

export async function createBarcode(payload: BarcodeWritePayload): Promise<Barcode> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(API_ENDPOINTS.BARCODES, payload);
  assertMutationSuccess(response, "Unable to create barcode.");

  const created = normalizeBarcode(response.data);
  if (created) return created;

  // Fall back to the requested values when the API returns no body.
  return {
    id: 0,
    number: payload.number,
    status: payload.status,
    container: payload.container ?? null,
  };
}

export async function updateBarcode(id: number, payload: BarcodeWritePayload): Promise<Barcode> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.BARCODES}/${id}`,
    payload,
  );
  assertMutationSuccess(response, "Unable to update barcode.");

  return (
    normalizeBarcode(response.data) ?? {
      id,
      number: payload.number,
      status: payload.status,
      container: payload.container ?? null,
    }
  );
}

export async function updateBarcodes(updates: BarcodeUpdate[]): Promise<Barcode[]> {
  return Promise.all(updates.map((update) => updateBarcode(update.id, update.payload)));
}

export async function fetchBarcodeById(id: number): Promise<Barcode> {
  const response = await apiClient.get<ApiBarcode | PaginatedApiEnvelope<ApiBarcode>>(
    `${API_ENDPOINTS.BARCODES}/${id}`,
  );

  const barcode = normalizeBarcode(unwrapEnvelope(response));
  if (!barcode) {
    throw new Error("Barcode not found.");
  }

  return barcode;
}

/** Retrieve an existing barcode by id, falling back to the invoice-detail snapshot. */
async function retrieveExistingBarcode(snapshot: InvoiceLineItemBarcode): Promise<Barcode> {
  const numericId = readNumericId(snapshot.id);
  if (numericId != null && numericId > 0) {
    try {
      return await fetchBarcodeById(numericId);
    } catch {
      // Fall through to the snapshot the invoice detail already provided.
    }
  }

  return {
    id: numericId ?? 0,
    number: snapshot.number,
    status: snapshot.statusName ? { id: snapshot.statusId, name: snapshot.statusName } : null,
    container: snapshot.containerName
      ? { id: readNumericId(snapshot.containerId), name: snapshot.containerName }
      : null,
    scanDate: snapshot.scanDate,
  };
}

function buildBarcodeNumber(invoiceNumber: string, lineItemId: string, sequence: number): string {
  const base = invoiceNumber.trim() || lineItemId.trim() || "LBL";
  return `${base}-${lineItemId}-${sequence}`;
}

function toGeneratedLabel(
  barcode: Barcode,
  context: { invoiceId: string; invoiceNumber: string; description: string },
  sequence: number,
  total: number,
  source: GeneratedLabelSource,
): GeneratedLabel {
  return {
    key: `${context.invoiceId}:${barcode.number || barcode.id}:${sequence}`,
    barcodeId: barcode.id,
    number: barcode.number,
    statusId: barcode.status?.id,
    statusName: barcode.status?.name ?? "—",
    containerId: barcode.container?.id,
    containerName: barcode.container?.name ?? "—",
    invoiceId: context.invoiceId,
    invoiceNumber: context.invoiceNumber,
    description: context.description,
    labelSequence: sequence,
    totalLabels: total,
    source,
  };
}

function findLineItem(lineItems: InvoiceLineItem[], lineItemId: string): InvoiceLineItem | undefined {
  return lineItems.find((item) => item.id === lineItemId || item.apiId === lineItemId);
}

/**
 * Generate labels for the selected invoice line items.
 *
 * For each line item we read the authoritative invoice detail. If barcodes
 * already exist for that line item we retrieve them; otherwise we create one
 * barcode per label via `POST /barcodes`.
 */
export async function generateLabels(targets: GenerateLabelTarget[]): Promise<GeneratedLabel[]> {
  if (targets.length === 0) return [];

  const invoiceIds = Array.from(new Set(targets.map((target) => target.invoiceId)));
  const invoices = await Promise.all(invoiceIds.map((id) => fetchInvoiceById(id)));
  const invoicesById = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));

  const labels: GeneratedLabel[] = [];

  for (const target of targets) {
    const invoice = invoicesById.get(target.invoiceId);
    if (!invoice) continue;

    const lineItem = findLineItem(invoice.lineItems, target.lineItemId);
    if (!lineItem) continue;

    const context = {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      description: lineItem.description?.trim() || lineItem.itemName,
    };

    const existing = lineItem.barcodes ?? [];

    if (existing.length > 0) {
      const retrieved = await Promise.all(existing.map(retrieveExistingBarcode));
      retrieved.forEach((barcode, index) => {
        labels.push(toGeneratedLabel(barcode, context, index + 1, retrieved.length, "existing"));
      });
      continue;
    }

    const count = Math.max(1, lineItem.labelCount || lineItem.quantity || 1);
    const container =
      invoice.containerId && readNumericId(invoice.containerId) != null
        ? { id: readNumericId(invoice.containerId)!, name: invoice.containerName ?? "" }
        : undefined;

    const created = await Promise.all(
      Array.from({ length: count }, (_entry, index) =>
        createBarcode({
          number: buildBarcodeNumber(invoice.invoiceNumber || invoice.invoiceId, lineItem.id, index + 1),
          status: NEW_BARCODE_STATUS,
          container,
        }),
      ),
    );

    created.forEach((barcode, index) => {
      labels.push(toGeneratedLabel(barcode, context, index + 1, created.length, "created"));
    });
  }

  return labels;
}

function barcodeHasContainer(barcode: InvoiceLineItemBarcode): boolean {
  return Boolean(barcode.containerName?.trim() || barcode.containerId?.trim());
}

/**
 * Collect assignable barcode ids from the given invoices.
 *
 * Invoice list rows do not reliably carry barcodes, so each invoice's detail is
 * fetched. Only barcodes that exist on a line item AND have a container qualify
 * for route (the container drives the route trip number).
 */
export async function collectAssignableInvoiceBarcodeIds(invoiceIds: string[]): Promise<number[]> {
  const uniqueIds = Array.from(new Set(invoiceIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const invoices = await Promise.all(uniqueIds.map((id) => fetchInvoiceById(id)));

  const barcodeIds = new Set<number>();
  for (const invoice of invoices) {
    for (const lineItem of invoice.lineItems) {
      for (const barcode of lineItem.barcodes ?? []) {
        if (!barcodeHasContainer(barcode)) continue;
        const numericId = readNumericId(barcode.id);
        if (numericId != null && numericId > 0) {
          barcodeIds.add(numericId);
        }
      }
    }
  }

  return Array.from(barcodeIds);
}

/**
 * Assign invoice-item barcodes to a route.
 * PUT /invoices/item/barcode/route/{routeId} with `{ barcodeIds }`.
 *
 * Each barcode must exist inside invoice_details.barcodes and have a container;
 * the container drives the computed route trip number. The barcode's existing
 * container is preserved (not duplicated inside the stored route reference).
 */
export async function assignInvoiceItemBarcodesToRoute(
  routeId: string,
  barcodeIds: number[],
): Promise<InvoiceItemBarcodeRoute> {
  const id = routeId.trim();
  if (!id) {
    throw new Error("A valid route is required.");
  }

  if (barcodeIds.length === 0) {
    throw new Error("The selected invoices have no barcodes with a container to assign.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<ApiBarcodeRouteData>>(
    `${API_ENDPOINTS.INVOICE_ITEM_BARCODE_ROUTE}/${id}`,
    { barcodeIds },
  );

  assertMutationSuccess(response, "Unable to assign invoice item barcodes to route.");

  const data = response.data;
  return {
    routeId: String(data?.route?.id ?? id).trim(),
    routeName: String(data?.route?.name ?? "").trim(),
    tripNumber: Number(data?.tripNumber ?? 0),
    assignedCount: Number(data?.assignedCount ?? barcodeIds.length),
  };
}
