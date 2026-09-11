import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  buildApiSearchPaginationQuery,
  buildStripeStyleSearchBody,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import { fetchInvoiceById, patchInvoiceEmbeddedBarcodes } from "@/lib/invoices/api/invoices-api";
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

type ApiBarcodeRoute = {
  id?: string;
  name?: string;
  routeId?: string;
};

type ApiBarcodeDelivery = {
  id?: number | string;
  name?: string;
};

type ApiBarcodeUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiBarcode = {
  id?: number | string;
  barcodeId?: number | string;
  number?: string;
  status?: ApiBarcodeStatus;
  container?: ApiBarcodeContainer;
  route?: ApiBarcodeRoute;
  delivery?: ApiBarcodeDelivery;
  tripNumber?: number;
  scanDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | ApiBarcodeUser;
  updatedBy?: string | ApiBarcodeUser;
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
  /** Delivery route (vehicle-route record id). */
  route?: { id: string; name: string };
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

/** A single barcode update to apply via `PUT /barcodes/{id}` or invoice embed patch. */
export type BarcodeUpdate = {
  /**
   * Catalog `/barcodes/{id}` numeric path id when `writeTarget` is `barcodes`.
   * For embedded updates this may be 0 when only ObjectID `barcodeId` is known.
   */
  id: number;
  /**
   * Unique ObjectID (or legacy numeric id as string) used for embedded matching
   * and report selection.
   */
  barcodeId?: string;
  invoiceId?: string;
  payload: BarcodeWritePayload;
  /** When set, skips target resolution and uses the matching write path. */
  writeTarget?: "barcodes" | "invoice-embedded";
};

type BarcodeWriteTarget =
  | { kind: "barcodes"; id: number }
  | { kind: "invoice-embedded"; id: string };

function readNumericId(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readObjectId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  // Pure integers are package-sequence / catalog numeric ids, not ObjectIDs.
  if (/^\d+$/.test(text)) return undefined;
  return text;
}

/** Prefer ObjectID `barcodeId`; fall back to numeric id string for legacy rows. */
export function resolveBarcodeIdentity(input: {
  barcodeId?: string | number | null;
  id?: number | string | null;
}): string {
  const objectId = readObjectId(input.barcodeId) ?? readObjectId(input.id);
  if (objectId) return objectId;

  const fromBarcodeId = readNumericId(input.barcodeId);
  if (fromBarcodeId != null && fromBarcodeId > 0) return String(fromBarcodeId);

  const fromId = readNumericId(input.id);
  if (fromId != null && fromId > 0) return String(fromId);

  return "";
}

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiBarcodeUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

function normalizeBarcodeRoute(raw: ApiBarcodeRoute | undefined) {
  const id = String(raw?.id ?? "").trim();
  const name = String(raw?.name ?? "").trim();
  const routeId = String(raw?.routeId ?? "").trim();

  if (!id && !name && !routeId) return null;

  return {
    id: id || routeId,
    name: name || id || routeId,
    routeId: routeId || undefined,
  };
}

function normalizeBarcodeDelivery(raw: ApiBarcodeDelivery | undefined) {
  const name = String(raw?.name ?? "").trim();
  const id = readNumericId(raw?.id);
  if (!name && id == null) return null;

  return {
    id,
    name: name || (id != null ? String(id) : ""),
  };
}

export function normalizeBarcode(raw: unknown): Barcode | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiBarcode;
  const number = String(item.number ?? "").trim();
  const id = readNumericId(item.id) ?? 0;
  const barcodeId = resolveBarcodeIdentity({ barcodeId: item.barcodeId, id: item.id });
  if (!number && id <= 0 && !barcodeId) return null;

  const statusName = String(item.status?.name ?? "").trim();
  const prevStatus = String(item.status?.prevStatus ?? "").trim();
  const containerName = String(item.container?.name ?? "").trim();
  const tripNumber = readNumericId(item.tripNumber);
  const createdBy = readUserName(item.createdBy);
  const updatedBy = readUserName(item.updatedBy);

  return {
    id,
    barcodeId: barcodeId || undefined,
    number,
    status: statusName
      ? {
          id: item.status?.id,
          name: statusName,
          prevStatus: prevStatus || undefined,
        }
      : null,
    container: containerName
      ? { id: readNumericId(item.container?.id), name: containerName }
      : null,
    route: normalizeBarcodeRoute(item.route),
    delivery: normalizeBarcodeDelivery(item.delivery),
    tripNumber: tripNumber && tripNumber > 0 ? tripNumber : undefined,
    scanDate: String(item.scanDate ?? "").trim() || undefined,
    createdAt: String(item.createdAt ?? "").trim() || undefined,
    updatedAt: String(item.updatedAt ?? "").trim() || undefined,
    createdBy: createdBy || undefined,
    updatedBy: updatedBy || undefined,
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
  if (created && created.id > 0) return created;

  const number = payload.number.trim();
  if (number) {
    try {
      return await fetchBarcodeByNumber(number);
    } catch {
      // Fall through to the requested values when lookup also fails.
    }
  }

  // Fall back to the requested values when the API returns no body.
  return {
    id: created?.id ?? 0,
    number: payload.number,
    status: payload.status,
    container: payload.container ?? null,
    route: null,
    delivery: null,
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
      route: null,
      delivery: null,
    }
  );
}

async function resolveBarcodeWriteTarget(
  candidateId: number,
  number: string,
  barcodeObjectId?: string,
): Promise<BarcodeWriteTarget> {
  const trimmedNumber = number.trim();
  const objectId = barcodeObjectId?.trim();

  if (trimmedNumber) {
    try {
      const found = await fetchBarcodeByNumber(trimmedNumber);
      if (found.id > 0) {
        return { kind: "barcodes", id: found.id };
      }
    } catch {
      // Legacy invoice labels live under invoiceDetails.barcodes, not /barcodes.
    }
  }

  if (objectId) {
    return { kind: "invoice-embedded", id: objectId };
  }

  if (candidateId > 0) {
    return { kind: "invoice-embedded", id: String(candidateId) };
  }

  if (!trimmedNumber) {
    throw new Error("Barcode number is required to update this label.");
  }

  throw new Error("Barcode not found.");
}

type ResolvedBarcodeUpdate = {
  invoiceId?: string;
  payload: BarcodeWritePayload;
  target: BarcodeWriteTarget;
};

async function resolveBarcodeUpdates(updates: BarcodeUpdate[]): Promise<ResolvedBarcodeUpdate[]> {
  return Promise.all(
    updates.map(async (update): Promise<ResolvedBarcodeUpdate> => {
      const embeddedId =
        update.barcodeId?.trim() ||
        (update.id > 0 ? String(update.id) : "");

      if (update.writeTarget === "invoice-embedded") {
        if (!embeddedId) {
          throw new Error("Barcode id is required to update embedded barcodes.");
        }
        return {
          invoiceId: update.invoiceId,
          payload: update.payload,
          target: { kind: "invoice-embedded", id: embeddedId },
        };
      }

      if (update.writeTarget === "barcodes") {
        const id =
          update.id > 0
            ? update.id
            : await resolveBarcodeIdForCatalogWrite(update.payload.number);
        return {
          payload: update.payload,
          target: { kind: "barcodes", id },
        };
      }

      return {
        invoiceId: update.invoiceId,
        payload: update.payload,
        target: await resolveBarcodeWriteTarget(update.id, update.payload.number, update.barcodeId),
      };
    }),
  );
}

function toEmbeddedPatch(target: Extract<BarcodeWriteTarget, { kind: "invoice-embedded" }>, payload: BarcodeWritePayload) {
  return {
    barcodeId: target.id,
    number: payload.number,
    status: payload.status,
    container: payload.container,
  };
}

export async function updateBarcodes(updates: BarcodeUpdate[]): Promise<Barcode[]> {
  const resolvedUpdates = await resolveBarcodeUpdates(updates);
  const catalogUpdates = resolvedUpdates.filter((update) => update.target.kind === "barcodes");
  const embeddedUpdates = resolvedUpdates.filter((update) => update.target.kind === "invoice-embedded");

  const catalogResults = await Promise.all(
    catalogUpdates.map((update) => {
      if (update.target.kind !== "barcodes") {
        throw new Error("Expected barcodes catalog write target.");
      }
      return updateBarcode(update.target.id, update.payload);
    }),
  );

  const embeddedByInvoice = new Map<string, ReturnType<typeof toEmbeddedPatch>[]>();
  for (const update of embeddedUpdates) {
    const invoiceId = update.invoiceId?.trim();
    if (!invoiceId) {
      throw new Error("Invoice id is required to update embedded barcodes.");
    }
    if (update.target.kind !== "invoice-embedded") {
      throw new Error("Expected invoice-embedded write target.");
    }

    const patches = embeddedByInvoice.get(invoiceId) ?? [];
    patches.push(toEmbeddedPatch(update.target, update.payload));
    embeddedByInvoice.set(invoiceId, patches);
  }

  const embeddedResults: Barcode[] = [];
  for (const [invoiceId, patches] of embeddedByInvoice) {
    await patchInvoiceEmbeddedBarcodes(invoiceId, patches);
    for (const patch of patches) {
      const legacyNumericId = readNumericId(patch.barcodeId);
      embeddedResults.push({
        id: legacyNumericId ?? 0,
        barcodeId: patch.barcodeId,
        number: patch.number,
        status: patch.status,
        container: patch.container ?? null,
        route: null,
        delivery: null,
      });
    }
  }

  return [...catalogResults, ...embeddedResults];
}

export async function fetchBarcodeByNumber(number: string): Promise<Barcode> {
  const trimmed = number.trim();
  if (!trimmed) {
    throw new Error("Barcode number is required.");
  }

  const paginationQuery = buildApiSearchPaginationQuery({
    page: 1,
    limit: 1,
    offset: 0,
  });

  const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.BARCODES}/search?${paginationQuery}`,
    buildStripeStyleSearchBody({
      filterGroups: [
        {
          operator: "and",
          filters: [{ field: "number", operator: "eq", value: trimmed }],
        },
      ],
    }),
  );

  const items = Array.isArray(response.data) ? response.data : [];
  const barcode = normalizeBarcode(items[0]);
  if (!barcode || barcode.id <= 0) {
    throw new Error("Barcode not found.");
  }

  return barcode;
}

async function resolveBarcodeIdForCatalogWrite(number: string): Promise<number> {
  const trimmedNumber = number.trim();
  if (!trimmedNumber) {
    throw new Error("Barcode number is required to update this label.");
  }

  const found = await fetchBarcodeByNumber(trimmedNumber);
  return found.id;
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

/** Retrieve an existing barcode by number or invoice-detail id. */
async function retrieveExistingBarcode(
  snapshot: InvoiceLineItemBarcode,
): Promise<{ barcode: Barcode; writeTarget: BarcodeWriteTarget["kind"] }> {
  const objectId = snapshot.barcodeId?.trim();
  const packageSequence = snapshot.packageSequence ?? readNumericId(snapshot.id);
  const number = snapshot.number.trim();

  if (number) {
    try {
      const barcode = await fetchBarcodeByNumber(number);
      return {
        barcode: {
          ...barcode,
          barcodeId: objectId || barcode.barcodeId || resolveBarcodeIdentity(barcode),
        },
        writeTarget: "barcodes",
      };
    } catch {
      // Embedded invoice barcodes are often invoice-detail records, not catalog rows.
    }
  }

  const identity = resolveBarcodeIdentity({
    barcodeId: objectId,
    id: packageSequence,
  });

  if (identity) {
    return {
      barcode: {
        id: packageSequence ?? 0,
        barcodeId: identity,
        number: snapshot.number,
        status: snapshot.statusName ? { id: snapshot.statusId, name: snapshot.statusName } : null,
        container: snapshot.containerName
          ? { id: readNumericId(snapshot.containerId), name: snapshot.containerName }
          : null,
        route: null,
        delivery:
          snapshot.deliveryName?.trim()
            ? {
                id: readNumericId(snapshot.deliveryId),
                name: snapshot.deliveryName.trim(),
              }
            : null,
        scanDate: snapshot.scanDate,
      },
      writeTarget: "invoice-embedded",
    };
  }

  throw new Error(number ? `Barcode not found: ${number}.` : "Barcode not found.");
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
  writeTarget: BarcodeWriteTarget["kind"] = "barcodes",
): GeneratedLabel {
  const barcodeId = resolveBarcodeIdentity(barcode);
  return {
    key: `${context.invoiceId}:${barcodeId || barcode.number || sequence}:${sequence}`,
    barcodeId,
    catalogId: writeTarget === "barcodes" && barcode.id > 0 ? barcode.id : undefined,
    packageSequence:
      writeTarget === "invoice-embedded" && barcode.id > 0 ? barcode.id : undefined,
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
    writeTarget,
  };
}

function findLineItem(lineItems: InvoiceLineItem[], lineItemId: string): InvoiceLineItem | undefined {
  return lineItems.find((item) => item.id === lineItemId || item.apiId === lineItemId);
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("The operation was aborted.", "AbortError");
}

/**
 * Generate labels for the selected invoice line items.
 *
 * For each line item we read the authoritative invoice detail. If barcodes
 * already exist for that line item we retrieve them; otherwise we create one
 * barcode per label via `POST /barcodes`.
 */
export async function generateLabels(
  targets: GenerateLabelTarget[],
  signal?: AbortSignal,
): Promise<GeneratedLabel[]> {
  if (targets.length === 0) return [];

  throwIfAborted(signal);
  const invoiceIds = Array.from(new Set(targets.map((target) => target.invoiceId)));
  const invoices = await Promise.all(invoiceIds.map((id) => fetchInvoiceById(id)));
  throwIfAborted(signal);
  const invoicesById = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));

  const labels: GeneratedLabel[] = [];

  for (const target of targets) {
    throwIfAborted(signal);
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
      retrieved.forEach(({ barcode, writeTarget }, index) => {
        labels.push(
          toGeneratedLabel(barcode, context, index + 1, retrieved.length, "existing", writeTarget),
        );
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

  throwIfAborted(signal);
  return labels;
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
  barcodeIds: string[],
): Promise<InvoiceItemBarcodeRoute> {
  const id = routeId.trim();
  if (!id) {
    throw new Error("A valid route is required.");
  }

  const ids = barcodeIds.map((entry) => entry.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error("The selected invoices have no barcodes with a container to assign.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<ApiBarcodeRouteData>>(
    `${API_ENDPOINTS.INVOICE_ITEM_BARCODE_ROUTE}/${id}`,
    { barcodeIds: ids },
  );

  assertMutationSuccess(response, "Unable to assign invoice item barcodes to route.");

  const data = response.data;
  return {
    routeId: String(data?.route?.id ?? id).trim(),
    routeName: String(data?.route?.name ?? "").trim(),
    tripNumber: Number(data?.tripNumber ?? 0),
    assignedCount: Number(data?.assignedCount ?? ids.length),
  };
}
