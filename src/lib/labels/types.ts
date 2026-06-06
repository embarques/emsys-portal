import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import { getRouteAssignmentById } from "@/lib/route-assignments/mock-data";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";

export type LabelStatus =
  | "pending"
  | "generated"
  | "printed"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type LabelActivityAction =
  | "generate"
  | "status_change"
  | "container_change"
  | "route_assignment_change"
  | "print";

export type ShipmentLabel = {
  labelId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceLineItemId: string;
  barcode: string;
  status: LabelStatus;
  containerId: string;
  routeAssignmentId?: string;
  description: string;
  labelSequence: number;
  totalLabels: number;
  quantity: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type LabelActivityEntry = {
  id: string;
  labelId: string;
  barcode: string;
  invoiceNumber: string;
  action: LabelActivityAction;
  message: string;
  success: boolean;
  timestamp: string;
  performedBy: string;
};

export type StagedLineItem = {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  lineItemId: string;
  description: string;
  labelCount: number;
  quantity: number;
  containerId: string;
  routeAssignmentId?: string;
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
  previousRouteAssignment?: string;
  newRouteAssignment?: string;
  totalLabels?: number;
  date?: string;
  dateTime: string;
  createdBy: string;
  message: string;
};

export type LabelUpdaterOptions = {
  changeStatus: boolean;
  newStatus?: LabelStatus;
  changeContainer: boolean;
  newContainerId?: string;
  changeRouteAssignment: boolean;
  newRouteAssignmentId?: string;
};

export type LabelFilterState = {
  query: string;
  status: LabelStatus | "all";
};

export const LABEL_STATUSES: { value: LabelStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "generated", label: "Generated" },
  { value: "printed", label: "Printed" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function createLabelId(): string {
  return createRecordId();
}

export function createStagedLineItemKey(invoiceId: string, lineItemId: string): string {
  return `${invoiceId}:${lineItemId}`;
}

export function generateBarcode(invoiceNumber: string, lineItemId: string, sequence: number): string {
  const invoicePart = invoiceNumber.replace(/[^A-Z0-9]/gi, "").slice(-8).toUpperCase();
  const linePart = lineItemId.replace(/[^A-Z0-9]/gi, "").slice(-4).toUpperCase();
  const seqPart = String(sequence).padStart(3, "0");
  const entropy = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LBL-${invoicePart}-${linePart}-${seqPart}-${entropy}`;
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

export function labelsExistForLineItem(
  labels: ShipmentLabel[],
  invoiceId: string,
  lineItemId: string
): boolean {
  return labels.some(
    (label) => label.invoiceId === invoiceId && label.invoiceLineItemId === lineItemId
  );
}

export function createActivityEntry(
  partial: Omit<LabelActivityEntry, "id" | "timestamp"> & { timestamp?: string }
): LabelActivityEntry {
  return {
    id: createRecordId(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
    ...partial,
  };
}

export function generateLabelsForLineItem(
  stagedItem: StagedLineItem,
  existingLabels: ShipmentLabel[],
  createdBy = DEFAULT_CREATED_BY
): { labels: ShipmentLabel[]; activities: LabelActivityEntry[] } {
  if (stagedItem.labelCount <= 0) {
    return {
      labels: [],
      activities: [
        createActivityEntry({
          labelId: "",
          barcode: "—",
          invoiceNumber: stagedItem.invoiceNumber,
          action: "generate",
          success: false,
          message: `Skipped "${stagedItem.description}": label count is 0.`,
          performedBy: createdBy,
        }),
      ],
    };
  }

  if (labelsExistForLineItem(existingLabels, stagedItem.invoiceId, stagedItem.lineItemId)) {
    return {
      labels: [],
      activities: [
        createActivityEntry({
          labelId: "",
          barcode: "—",
          invoiceNumber: stagedItem.invoiceNumber,
          action: "generate",
          success: false,
          message: `Labels already exist for ${stagedItem.invoiceNumber} · ${stagedItem.description}. Change status or container instead.`,
          performedBy: createdBy,
        }),
      ],
    };
  }

  const now = new Date().toISOString();
  const assignment = stagedItem.routeAssignmentId
    ? getRouteAssignmentById(stagedItem.routeAssignmentId)
    : undefined;
  const routeSuffix = assignment ? ` Assigned to ${formatRouteAssignmentCopyLabel(assignment)}.` : "";

  const labels: ShipmentLabel[] = Array.from({ length: stagedItem.labelCount }, (_, index) => {
    const sequence = index + 1;
    return {
      labelId: createLabelId(),
      invoiceId: stagedItem.invoiceId,
      invoiceNumber: stagedItem.invoiceNumber,
      invoiceLineItemId: stagedItem.lineItemId,
      barcode: generateBarcode(stagedItem.invoiceNumber, stagedItem.lineItemId, sequence),
      status: "generated",
      containerId: stagedItem.containerId,
      routeAssignmentId: stagedItem.routeAssignmentId,
      description: stagedItem.description,
      labelSequence: sequence,
      totalLabels: stagedItem.labelCount,
      quantity: stagedItem.quantity,
      createdAt: now,
      createdBy,
      updatedAt: now,
    };
  });

  return {
    labels,
    activities: labels.map((label) =>
      createActivityEntry({
        labelId: label.labelId,
        barcode: label.barcode,
        invoiceNumber: stagedItem.invoiceNumber,
        action: "generate",
        success: true,
        message: `Label ${label.labelSequence}/${label.totalLabels} created for ${stagedItem.description}.${routeSuffix}`,
        performedBy: createdBy,
        timestamp: now,
      })
    ),
  };
}
