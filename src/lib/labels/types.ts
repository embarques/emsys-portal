export type StagedLineItem = {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  lineItemId: string;
  description: string;
  labelCount: number;
  quantity: number;
  containerId: string;
  routeId?: string;
  /** Pre-resolved label from the live route catalog (optional). */
  routeLabel?: string;
};

export type LabelUpdateResult = {
  id: string;
  success: boolean;
  barcode: string;
  invoiceNumber?: string;
  container?: string;
  previousStatus?: string;
  newStatus?: string;
  previousContainer?: string;
  newContainer?: string;
  previousRoute?: string;
  newRoute?: string;
  totalLabels?: number;
  date?: string;
  dateTime: string;
  createdBy: string;
  message: string;
};

/** Options for the live barcode scanner (`PUT /barcodes/{id}`). */
export type BarcodeScannerOptions = {
  changeStatus: boolean;
  newStatusId?: number;
  changeContainer: boolean;
  newContainerId?: string;
  changeRoute: boolean;
  /** Vehicle-route record id (`ActiveRoute.id`). */
  newRouteRecordId?: string;
  /** Live tenant catalog; fetched from status-options when omitted. */
  statusOptions?: readonly BarcodeStatusOption[];
  resolveRouteLabel?: (routeRecordId: string) => string;
  resolveContainerLabel?: (containerId: string) => string;
};

/** Status reference returned by / sent to the EMSYS barcode API. */
export type BarcodeStatusRef = {
  id?: number;
  name: string;
  prevStatus?: string;
};

/** Container reference returned by / sent to the EMSYS barcode API. */
export type BarcodeContainerRef = {
  id?: number;
  name: string;
};

/** Delivery route reference embedded on a barcode (`route` on GET /barcodes). */
export type BarcodeRouteRef = {
  id: string;
  name: string;
  routeId?: string;
};

/** Delivery record reference embedded on a barcode. */
export type BarcodeDeliveryRef = {
  id?: number;
  name: string;
};

/** Normalized barcode record from the EMSYS `/barcodes` API. */
export type Barcode = {
  id: number;
  /**
   * ObjectID when present (catalog Mongo id or invoice-embedded `barcodeId`).
   * Prefer this over numeric `id` for print selection and embedded matching.
   */
  barcodeId?: string;
  number: string;
  /** Invoice that originated this merchandise label (when the API returns it). */
  invoiceId?: string;
  invoiceNumber?: string;
  /** Line-item / merchandise description associated with the label. */
  description?: string;
  status: BarcodeStatusRef | null;
  container: BarcodeContainerRef | null;
  /** Assigned delivery route (vehicle-route), not the route-manager catalog row. */
  route: BarcodeRouteRef | null;
  delivery: BarcodeDeliveryRef | null;
  tripNumber?: number;
  scanDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type GeneratedLabelSource = "created" | "existing";

/** A barcode plus the invoice/line-item context shown in the generate-labels view. */
export type GeneratedLabel = {
  key: string;
  /**
   * Unique barcode identity for print / route assign / embedded patches.
   * ObjectID `barcodeId` when available; otherwise legacy numeric id as string.
   */
  barcodeId: string;
  /** Catalog `/barcodes/{id}` path id when the write target is the barcodes collection. */
  catalogId?: number;
  /** Package sequence from the embedded invoice barcode model (not unique). */
  packageSequence?: number;
  number: string;
  statusId?: number;
  statusName: string;
  containerId?: number;
  containerName: string;
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  labelSequence: number;
  totalLabels: number;
  source: GeneratedLabelSource;
  /** Last assigned daily-route label shown in the local change log. */
  routeName?: string;
  /** API write path for status/container updates. */
  writeTarget?: "barcodes" | "invoice-embedded";
};

/**
 * Default status for a freshly created barcode.
 * Backend should apply this when status is omitted; portal sends it on
 * `POST /barcodes` / label generation so new labels are never empty.
 */
export const NEW_BARCODE_STATUS: { id: number; name: string } = {
  id: 1,
  name: "ALM-NY",
};

/** Barcode location status from tenant `barcode_statuses` / status-options. */
export type BarcodeStatusOption = {
  id: number;
  name: string;
  prevStatus?: string;
};

/**
 * Offline / bootstrap fallback when `GET /barcodes/status-options` is empty.
 * Prefer live options from the API. Names are location codes, not workflow stages.
 */
export const FALLBACK_BARCODE_STATUS_OPTIONS: BarcodeStatusOption[] = [
  { id: 1, name: "ALM-NY" },
  { id: 2, name: "DEV-NY" },
  { id: 3, name: "EN TRANSITO" },
  { id: 4, name: "ALM-RD" },
  { id: 5, name: "DEV-RD" },
  { id: 6, name: "CONDUCE" },
  { id: 7, name: "ENTREGADO" },
  { id: 8, name: "SUBASTADO" },
];

/** Resolve a write payload status ref from stored ids/names on a label snapshot. */
export function resolveBarcodeStatusRef(
  statusId: number | undefined,
  statusName: string,
  options: readonly BarcodeStatusOption[] = FALLBACK_BARCODE_STATUS_OPTIONS,
): { id: number; name: string } {
  const trimmedName = statusName.trim();
  if (statusId != null && statusId > 0) {
    const byId = options.find((entry) => entry.id === statusId);
    return { id: statusId, name: byId?.name ?? (trimmedName || "—") };
  }

  const normalizedName = trimmedName.toUpperCase();
  const option = options.find((entry) => entry.name.toUpperCase() === normalizedName);
  if (option) return { id: option.id, name: option.name };

  return { id: statusId ?? 0, name: trimmedName || "—" };
}

export function findBarcodeStatusOption(
  statusId: number | string | undefined,
  options: readonly BarcodeStatusOption[],
): BarcodeStatusOption | undefined {
  const parsed = Number(statusId);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return options.find((entry) => entry.id === parsed);
}

export function findBarcodeStatusOptionByName(
  statusName: string | undefined,
  options: readonly BarcodeStatusOption[],
): BarcodeStatusOption | undefined {
  const normalized = statusName?.trim().toUpperCase() ?? "";
  if (!normalized) return undefined;
  return options.find((entry) => entry.name.toUpperCase() === normalized);
}

export function createStagedLineItemKey(invoiceId: string, lineItemId: string): string {
  return `${invoiceId}:${lineItemId}`;
}

export function buildStagedLineItems(
  invoiceIds: string[],
  invoices: { invoiceId: string; invoiceNumber: string; containerId: string; lineItems: { id: string; itemName: string; labelCount: number; quantity: number }[] }[]
): StagedLineItem[] {
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));

  return invoiceIds.flatMap((invoiceId) => {
    const invoice = invoiceMap.get(invoiceId);
    if (!invoice) return [];

    return invoice.lineItems.map((lineItem) => ({
      key: createStagedLineItemKey(invoiceId, lineItem.id),
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      lineItemId: lineItem.id,
      description: lineItem.itemName,
      labelCount: lineItem.labelCount,
      quantity: lineItem.quantity,
      containerId: invoice.containerId,
    }));
  });
}

