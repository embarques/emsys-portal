import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
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
  performedBy = DEFAULT_CREATED_BY
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
  performedBy = DEFAULT_CREATED_BY
): LabelUpdateResult {
  const barcode = barcodeInput.trim();
  const timestamp = new Date().toISOString();
  const resolveRouteLabel = options.resolveRouteLabel ?? ((id: string) => id);

  if (!barcode) {
    return failureResult("—", "Barcode is required.", timestamp, performedBy);
  }

  if (!options.changeStatus && !options.changeContainer && !options.changeRoute) {
    return failureResult(barcode, "Select at least one field to update (status, container, or route).", timestamp, performedBy);
  }

  if (options.changeStatus && !options.newStatus) {
    return failureResult(barcode, "Select a new status.", timestamp, performedBy);
  }

  if (options.changeContainer && !options.newContainerId) {
    return failureResult(barcode, "Select a new container.", timestamp, performedBy);
  }

  if (options.changeRoute && !options.newRouteId) {
    return failureResult(barcode, "Select a new route.", timestamp, performedBy);
  }

  const label = findLabelByBarcode(barcode);
  if (!label) {
    return failureResult(barcode, `No label found for barcode "${barcode}".`, timestamp, performedBy);
  }

  const previousStatus = getLabelStatusLabel(label.status);
  const previousContainer = getLabelContainerLabel(label.containerId);
  const previousRoute = label.routeId
    ? resolveRouteLabel(label.routeId)
    : undefined;

  let changed = false;
  const result: LabelUpdateResult = {
    id: createRecordId(),
    success: true,
    barcode: label.barcode,
    invoiceNumber: label.invoiceNumber,
    container: getLabelContainerLabel(label.containerId),
    totalLabels: label.totalLabels,
    date: formatResultDate(timestamp),
    dateTime: formatResultDateTime(timestamp),
    createdBy: performedBy,
    message: "Label updated successfully.",
  };

  if (options.changeStatus && options.newStatus) {
    if (label.status !== options.newStatus) {
      result.previousStatus = previousStatus;
      result.newStatus = getLabelStatusLabel(options.newStatus);
      changed = true;
    } else {
      result.previousStatus = previousStatus;
      result.newStatus = previousStatus;
    }
  }

  if (options.changeContainer && options.newContainerId) {
    if (label.containerId !== options.newContainerId) {
      result.previousContainer = previousContainer;
      result.newContainer = getLabelContainerLabel(options.newContainerId);
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
      ...failureResult(barcode, "No changes applied — selected values match the current label.", timestamp, performedBy),
      invoiceNumber: label.invoiceNumber,
      container: getLabelContainerLabel(label.containerId),
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
        routeId:
          options.changeRoute && options.newRouteId
            ? options.newRouteId
            : entry.routeId,
        updatedAt: timestamp,
      };
    })
  );

  const changeParts: string[] = [];
  if (result.previousStatus && result.newStatus) {
    changeParts.push(`status ${result.previousStatus} → ${result.newStatus}`);
  }
  if (result.previousContainer && result.newContainer) {
    changeParts.push(`container ${result.previousContainer} → ${result.newContainer}`);
  }
  if (result.previousRoute !== undefined && result.newRoute) {
    changeParts.push(`route ${result.previousRoute} → ${result.newRoute}`);
  }

  result.message = `Updated ${changeParts.join("; ")}.`;

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
  performedBy = DEFAULT_CREATED_BY
): LabelUpdateResult[] {
  return barcodes.map((barcode) => applyLabelBarcodeUpdate(barcode, options, performedBy));
}
