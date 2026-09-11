import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { fetchBarcodeStatusOptions } from "@/lib/barcodes/api/barcode-status-options-api";
import {
  findInvoiceBarcodeByNumber,
  patchInvoiceEmbeddedBarcodes,
} from "@/lib/invoices/api/invoices-api";
import type { InvoiceLineItemBarcode } from "@/lib/invoices/types";
import { getBarcodeStatusLabel } from "@/lib/labels/display";
import {
  fetchBarcodeByNumber,
  updateBarcode,
  type BarcodeWritePayload,
} from "@/lib/labels/api/barcodes-api";
import {
  FALLBACK_BARCODE_STATUS_OPTIONS,
  NEW_BARCODE_STATUS,
  type Barcode,
  type BarcodeScannerOptions,
  type BarcodeStatusOption,
  type LabelUpdateResult,
} from "@/lib/labels/types";

function formatResultDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatResultDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function failureResult(
  barcode: string,
  message: string,
  timestamp: string,
  performedBy = DEFAULT_CREATED_BY,
): LabelUpdateResult {
  return {
    id: createRecordId(),
    success: false,
    barcode,
    dateTime: formatResultDateTime(timestamp),
    date: formatResultDate(timestamp),
    createdBy: performedBy,
    message,
  };
}

function resolveStatusRef(
  statusId: number,
  options: readonly BarcodeStatusOption[],
): { id: number; name: string } {
  const option = options.find((entry) => entry.id === statusId);
  if (!option) {
    throw new Error("Select a valid status.");
  }
  return { id: option.id, name: option.name };
}

async function resolveStatusCatalog(
  options: BarcodeScannerOptions,
): Promise<readonly BarcodeStatusOption[]> {
  if (options.statusOptions?.length) return options.statusOptions;
  return fetchBarcodeStatusOptions();
}

function formatStatusLabel(
  status: Barcode["status"],
  t?: TranslateFn,
): string {
  const name = status?.name?.trim();
  if (!name) return "—";
  return t ? getBarcodeStatusLabel(name, t) : name;
}

function formatContainerLabel(
  container: Barcode["container"],
  resolveContainerLabel?: (containerId: string) => string,
): string {
  if (container?.name?.trim()) return container.name.trim();
  if (container?.id != null && container.id > 0) {
    return resolveContainerLabel?.(String(container.id)) ?? String(container.id);
  }
  return "—";
}

function formatRouteLabel(
  route: Barcode["route"],
  resolveRouteLabel?: (routeRecordId: string) => string,
): string {
  if (!route?.id) return "—";
  const embedded = route.name?.trim();
  if (embedded && embedded !== route.id) return embedded;
  return resolveRouteLabel?.(route.id) ?? embedded ?? route.id;
}

function buildBarcodeWritePayload(
  existing: Barcode,
  options: BarcodeScannerOptions,
  statusCatalog: readonly BarcodeStatusOption[],
): { payload: BarcodeWritePayload; changed: boolean } {
  const catalog = statusCatalog.length ? statusCatalog : FALLBACK_BARCODE_STATUS_OPTIONS;
  const payload: BarcodeWritePayload = {
    number: existing.number,
    status: resolveStatusRef(
      existing.status?.id && existing.status.id > 0
        ? existing.status.id
        : catalog.find(
            (entry) => entry.name === existing.status?.name?.trim().toUpperCase(),
          )?.id ?? catalog[0]!.id,
      catalog,
    ),
  };

  if (existing.container?.id != null && existing.container.id > 0) {
    payload.container = {
      id: existing.container.id,
      name: existing.container.name?.trim() || String(existing.container.id),
    };
  }

  if (existing.route?.id) {
    payload.route = {
      id: existing.route.id,
      name: existing.route.name?.trim() || existing.route.id,
    };
  }

  let changed = false;

  if (options.changeStatus && options.newStatusId != null) {
    const nextStatus = resolveStatusRef(options.newStatusId, catalog);
    if (payload.status.id !== nextStatus.id) {
      payload.status = nextStatus;
      changed = true;
    }
  }

  if (options.changeContainer && options.newContainerId) {
    const parsedId = Number(options.newContainerId);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new Error("Select a valid container.");
    }

    const nextName =
      options.resolveContainerLabel?.(options.newContainerId) ?? String(parsedId);
    if (payload.container?.id !== parsedId) {
      payload.container = { id: parsedId, name: nextName };
      changed = true;
    }
  }

  if (options.changeRoute && options.newRouteRecordId?.trim()) {
    const routeId = options.newRouteRecordId.trim();
    const routeName = options.resolveRouteLabel?.(routeId) ?? routeId;
    if (payload.route?.id !== routeId) {
      payload.route = { id: routeId, name: routeName };
      changed = true;
    }
  }

  return { payload, changed };
}

/**
 * Apply a barcode scanner update.
 *
 * Merchandise barcodes originate on invoices (line items + labels). Prefer the
 * invoice-embedded record, then fall back to the `/barcodes` catalog mirror.
 */
export async function applyBarcodeScanUpdate(
  barcodeInput: string,
  options: BarcodeScannerOptions,
  performedBy = DEFAULT_CREATED_BY,
  t?: TranslateFn,
): Promise<LabelUpdateResult> {
  const barcode = barcodeInput.trim();
  const timestamp = new Date().toISOString();
  const translate = (key: string, params?: Record<string, string | number>) =>
    t ? t(key, params) : key;

  if (!barcode) {
    return failureResult("—", translate("labels.updater.errors.barcodeRequired"), timestamp, performedBy);
  }

  if (!options.changeStatus && !options.changeContainer && !options.changeRoute) {
    return failureResult(
      barcode,
      translate("labels.updater.errors.selectAtLeastOne"),
      timestamp,
      performedBy,
    );
  }

  if (options.changeStatus && options.newStatusId == null) {
    return failureResult(barcode, translate("labels.updater.errors.selectNewStatus"), timestamp, performedBy);
  }

  if (options.changeContainer && !options.newContainerId) {
    return failureResult(
      barcode,
      translate("labels.updater.errors.selectNewContainer"),
      timestamp,
      performedBy,
    );
  }

  if (options.changeRoute && !options.newRouteRecordId?.trim()) {
    return failureResult(barcode, translate("labels.updater.errors.selectNewRoute"), timestamp, performedBy);
  }

  let existing: Barcode;
  let embedded:
    | {
        invoiceId: string;
        invoiceNumber: string;
        barcode: InvoiceLineItemBarcode;
      }
    | null = null;

  embedded = await findInvoiceBarcodeByNumber(barcode);
  if (embedded) {
    existing = {
      id: embedded.barcode.packageSequence ?? 0,
      barcodeId: embedded.barcode.barcodeId,
      number: embedded.barcode.number,
      status: embedded.barcode.statusName
        ? { id: embedded.barcode.statusId, name: embedded.barcode.statusName }
        : null,
      container: embedded.barcode.containerName
        ? {
            id: Number(embedded.barcode.containerId) || undefined,
            name: embedded.barcode.containerName,
          }
        : null,
      route: embedded.barcode.routeId
        ? {
            id: embedded.barcode.routeId,
            name: embedded.barcode.routeName ?? embedded.barcode.routeId,
          }
        : null,
      delivery: embedded.barcode.deliveryName
        ? {
            id: Number(embedded.barcode.deliveryId) || undefined,
            name: embedded.barcode.deliveryName,
          }
        : null,
    };
  } else {
    try {
      existing = await fetchBarcodeByNumber(barcode);
    } catch {
      return failureResult(
        barcode,
        translate("labels.updater.errors.notFound", { barcode }),
        timestamp,
        performedBy,
      );
    }
  }

  const previousStatus = formatStatusLabel(existing.status, t);
  const previousContainer = formatContainerLabel(existing.container, options.resolveContainerLabel);
  const previousRoute = formatRouteLabel(existing.route, options.resolveRouteLabel);

  let payload: BarcodeWritePayload;
  let changed = false;

  try {
    const statusCatalog = await resolveStatusCatalog(options);
    const built = buildBarcodeWritePayload(existing, options, statusCatalog);
    payload = built.payload;
    changed = built.changed;
  } catch (error) {
    const message = error instanceof Error ? error.message : translate("labels.updater.errors.notFound", { barcode });
    return failureResult(barcode, message, timestamp, performedBy);
  }

  if (!changed) {
    const result: LabelUpdateResult = {
      id: createRecordId(),
      success: true,
      barcode,
      invoiceNumber: embedded?.invoiceNumber,
      container: previousContainer,
      date: formatResultDate(timestamp),
      dateTime: formatResultDateTime(timestamp),
      createdBy: performedBy,
      message: translate("labels.updater.success.labelUpdated"),
    };

    if (options.changeStatus) {
      result.previousStatus = previousStatus;
      result.newStatus = previousStatus;
    }
    if (options.changeContainer) {
      result.previousContainer = previousContainer;
      result.newContainer = previousContainer;
      result.container = previousContainer;
    }
    if (options.changeRoute) {
      result.previousRoute = previousRoute;
      result.newRoute = previousRoute;
    }

    return result;
  }

  let updated: Barcode;
  if (embedded) {
    const status =
      payload.status?.id != null && payload.status.id > 0 && payload.status.name?.trim()
        ? { id: payload.status.id, name: payload.status.name.trim() }
        : NEW_BARCODE_STATUS;

    await patchInvoiceEmbeddedBarcodes(embedded.invoiceId, [
      {
        barcodeId: embedded.barcode.barcodeId?.trim() || "",
        number: embedded.barcode.number,
        status,
        ...(payload.container
          ? { container: { id: payload.container.id, name: payload.container.name } }
          : {}),
        ...(payload.route
          ? { route: { id: payload.route.id, name: payload.route.name } }
          : {}),
      },
    ]);

    // Keep the `/barcodes` directory mirror in sync when present.
    try {
      const catalog = await fetchBarcodeByNumber(embedded.barcode.number);
      if (catalog.id > 0) {
        await updateBarcode(catalog.id, {
          number: embedded.barcode.number,
          status,
          container: payload.container ?? undefined,
          route: payload.route ?? undefined,
        });
      }
    } catch {
      // Catalog may not have a row yet; invoice embed remains authoritative.
    }

    updated = {
      ...existing,
      status,
      container: payload.container
        ? { id: payload.container.id, name: payload.container.name }
        : existing.container,
      route: payload.route
        ? { id: payload.route.id, name: payload.route.name }
        : existing.route,
    };
  } else {
    updated = await updateBarcode(existing.id, payload);
  }

  const resultTimestamp = updated.updatedAt ?? timestamp;

  const result: LabelUpdateResult = {
    id: createRecordId(),
    success: true,
    barcode: updated.number,
    invoiceNumber: embedded?.invoiceNumber,
    container: formatContainerLabel(updated.container, options.resolveContainerLabel),
    date: formatResultDate(resultTimestamp),
    dateTime: formatResultDateTime(resultTimestamp),
    createdBy: updated.updatedBy ?? updated.createdBy ?? performedBy,
    message: translate("labels.updater.success.labelUpdated"),
  };

  if (options.changeStatus) {
    result.previousStatus = previousStatus;
    result.newStatus = formatStatusLabel(updated.status, t);
  }

  if (options.changeContainer) {
    result.previousContainer = previousContainer;
    result.newContainer = formatContainerLabel(updated.container, options.resolveContainerLabel);
    result.container = result.newContainer;
  }

  if (options.changeRoute) {
    result.previousRoute = previousRoute;
    result.newRoute = formatRouteLabel(updated.route, options.resolveRouteLabel);
  }

  const changeParts: string[] = [];
  if (result.previousStatus && result.newStatus) {
    changeParts.push(
      translate("labels.updater.changeParts.status", {
        from: result.previousStatus,
        to: result.newStatus,
      }),
    );
  }
  if (result.previousContainer && result.newContainer) {
    changeParts.push(
      translate("labels.updater.changeParts.container", {
        from: result.previousContainer,
        to: result.newContainer,
      }),
    );
  }
  if (result.previousRoute !== undefined && result.newRoute) {
    changeParts.push(
      translate("labels.updater.changeParts.route", {
        from: result.previousRoute,
        to: result.newRoute,
      }),
    );
  }

  result.message = translate("labels.updater.success.updated", {
    changes: changeParts.join("; "),
  });

  return result;
}

export async function applyBarcodeScanUpdates(
  barcodes: string[],
  options: BarcodeScannerOptions,
  performedBy = DEFAULT_CREATED_BY,
  t?: TranslateFn,
): Promise<LabelUpdateResult[]> {
  const results: LabelUpdateResult[] = [];
  for (const entry of barcodes) {
    results.push(await applyBarcodeScanUpdate(entry, options, performedBy, t));
  }
  return results;
}
