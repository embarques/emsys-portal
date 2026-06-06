import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import { getRouteAssignmentLabel } from "@/lib/orders/display";
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

  if (!barcode) {
    return failureResult("—", "Barcode is required.", timestamp, performedBy);
  }

  if (!options.changeStatus && !options.changeContainer && !options.changeRouteAssignment) {
    return failureResult(barcode, "Select at least one field to update (status, container, or route assignment).", timestamp, performedBy);
  }

  if (options.changeStatus && !options.newStatus) {
    return failureResult(barcode, "Select a new status.", timestamp, performedBy);
  }

  if (options.changeContainer && !options.newContainerId) {
    return failureResult(barcode, "Select a new container.", timestamp, performedBy);
  }

  if (options.changeRouteAssignment && !options.newRouteAssignmentId) {
    return failureResult(barcode, "Select a new route assignment.", timestamp, performedBy);
  }

  const label = findLabelByBarcode(barcode);
  if (!label) {
    return failureResult(barcode, `No label found for barcode "${barcode}".`, timestamp, performedBy);
  }

  const previousStatus = getLabelStatusLabel(label.status);
  const previousContainer = getLabelContainerLabel(label.containerId);
  const previousRouteAssignment = label.routeAssignmentId
    ? getRouteAssignmentLabel(label.routeAssignmentId)
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

  if (options.changeRouteAssignment && options.newRouteAssignmentId) {
    const newRouteLabel = getRouteAssignmentLabel(options.newRouteAssignmentId);
    if (label.routeAssignmentId !== options.newRouteAssignmentId) {
      result.previousRouteAssignment = previousRouteAssignment ?? "—";
      result.newRouteAssignment = newRouteLabel;
      changed = true;
    } else {
      result.previousRouteAssignment = previousRouteAssignment ?? newRouteLabel;
      result.newRouteAssignment = newRouteLabel;
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
      previousRouteAssignment: result.previousRouteAssignment,
      newRouteAssignment: result.newRouteAssignment,
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
        routeAssignmentId:
          options.changeRouteAssignment && options.newRouteAssignmentId
            ? options.newRouteAssignmentId
            : entry.routeAssignmentId,
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
  if (result.previousRouteAssignment !== undefined && result.newRouteAssignment) {
    changeParts.push(`route ${result.previousRouteAssignment} → ${result.newRouteAssignment}`);
  }

  result.message = `Updated ${changeParts.join("; ")}.`;

  let action: LabelActivityEntry["action"] = "status_change";
  if (options.changeContainer && !options.changeStatus && !options.changeRouteAssignment) {
    action = "container_change";
  } else if (options.changeRouteAssignment && !options.changeStatus && !options.changeContainer) {
    action = "route_assignment_change";
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
