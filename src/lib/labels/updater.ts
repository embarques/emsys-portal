/**
 * @deprecated Legacy in-memory label updater. The barcode scanner workspace uses
 * `applyBarcodeScanUpdate` in `src/lib/labels/api/label-updater-api.ts` (live API).
 */
import { createRecordId } from "@/lib/customers/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { getLabelContainerLabel, getLabelStatusLabel } from "@/lib/labels/display";
import { findLabelByBarcode, mutateLabelsStore, prependLabelActivity } from "@/lib/labels/store";
import {
  createActivityEntry,
  type LabelUpdateResult,
  type LabelUpdaterOptions,
  type LabelActivityEntry,
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

export function applyLabelBarcodeUpdate(
  barcodeInput: string,
  options: LabelUpdaterOptions,
  performedBy = DEFAULT_CREATED_BY,
  t?: TranslateFn,
): LabelUpdateResult {
  const barcode = barcodeInput.trim();
  const timestamp = new Date().toISOString();
  const resolveRouteLabel = options.resolveRouteLabel ?? ((id: string) => id);
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

  if (options.changeStatus && !options.newStatus) {
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

  if (options.changeRoute && !options.newRouteId) {
    return failureResult(barcode, translate("labels.updater.errors.selectNewRoute"), timestamp, performedBy);
  }

  const label = findLabelByBarcode(barcode);
  if (!label) {
    return failureResult(
      barcode,
      translate("labels.updater.errors.notFound", { barcode }),
      timestamp,
      performedBy,
    );
  }

  const previousStatus = t ? getLabelStatusLabel(label.status, t) : label.status;
  const previousContainer = getLabelContainerLabel(label.containerId, t);
  const previousRoute = label.routeId ? resolveRouteLabel(label.routeId) : undefined;

  let changed = false;
  const result: LabelUpdateResult = {
    id: createRecordId(),
    success: true,
    barcode: label.barcode,
    invoiceNumber: label.invoiceNumber,
    container: getLabelContainerLabel(label.containerId, t),
    totalLabels: label.totalLabels,
    date: formatResultDate(timestamp),
    dateTime: formatResultDateTime(timestamp),
    createdBy: performedBy,
    message: translate("labels.updater.success.labelUpdated"),
  };

  if (options.changeStatus && options.newStatus) {
    const newStatusLabel = t ? getLabelStatusLabel(options.newStatus, t) : options.newStatus;
    if (label.status !== options.newStatus) {
      result.previousStatus = previousStatus;
      result.newStatus = newStatusLabel;
      changed = true;
    } else {
      result.previousStatus = previousStatus;
      result.newStatus = previousStatus;
    }
  }

  if (options.changeContainer && options.newContainerId) {
    if (label.containerId !== options.newContainerId) {
      result.previousContainer = previousContainer;
      result.newContainer = getLabelContainerLabel(options.newContainerId, t);
      result.container = result.newContainer;
      changed = true;
    } else {
      result.previousContainer = previousContainer;
      result.newContainer = previousContainer;
    }
  }

  if (options.changeRoute && options.newRouteId) {
    const newRouteLabel = resolveRouteLabel(options.newRouteId);
    if (label.routeId !== options.newRouteId) {
      result.previousRoute = previousRoute ?? "—";
      result.newRoute = newRouteLabel;
      changed = true;
    } else {
      result.previousRoute = previousRoute ?? newRouteLabel;
      result.newRoute = newRouteLabel;
    }
  }

  if (!changed) {
    return {
      ...failureResult(
        barcode,
        translate("labels.updater.errors.noChanges"),
        timestamp,
        performedBy,
      ),
      invoiceNumber: label.invoiceNumber,
      container: getLabelContainerLabel(label.containerId, t),
      totalLabels: label.totalLabels,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      previousContainer: result.previousContainer,
      newContainer: result.newContainer,
      previousRoute: result.previousRoute,
      newRoute: result.newRoute,
    };
  }

  mutateLabelsStore((current) =>
    current.map((entry) => {
      if (entry.labelId !== label.labelId) return entry;

      return {
        ...entry,
        status: options.changeStatus && options.newStatus ? options.newStatus : entry.status,
        containerId:
          options.changeContainer && options.newContainerId ? options.newContainerId : entry.containerId,
        routeId: options.changeRoute && options.newRouteId ? options.newRouteId : entry.routeId,
        updatedAt: timestamp,
      };
    }),
  );

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

  let action: LabelActivityEntry["action"] = "status_change";
  if (options.changeContainer && !options.changeStatus && !options.changeRoute) {
    action = "container_change";
  } else if (options.changeRoute && !options.changeStatus && !options.changeContainer) {
    action = "route_change";
  }

  prependLabelActivity([
    createActivityEntry({
      labelId: label.labelId,
      barcode: label.barcode,
      invoiceNumber: label.invoiceNumber,
      action,
      success: true,
      message: result.message,
      performedBy,
      timestamp,
    }),
  ]);

  return result;
}

export function applyLabelBarcodeUpdates(
  barcodes: string[],
  options: LabelUpdaterOptions,
  performedBy = DEFAULT_CREATED_BY,
  t?: TranslateFn,
): LabelUpdateResult[] {
  return barcodes.map((barcode) => applyLabelBarcodeUpdate(barcode, options, performedBy, t));
}
