"use client";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatContainerDate,
  formatContainerId,
  formatOptionalContainerCost,
} from "@/lib/containers/display";
import type { Container } from "@/lib/containers/types";

type ContainerViewSheetProps = {
  container: Container | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (container: Container) => void;
  onDelete: (container: Container) => void;
};

export function ContainerViewSheet({
  container,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ContainerViewSheetProps) {
  if (!container) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={container.name}
          description={<span className="font-mono text-xs">{container.containerNumber}</span>}
          meta={
            <>
              <Badge variant="outline">{container.company || "No carrier"}</Badge>
              <Badge variant="secondary">{formatOptionalContainerCost(container.cost)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Shipping">
            <RecordViewSheetDetailRow label="Container ID" value={formatContainerId(container.id)} />
            <RecordViewSheetDetailRow label="Container" value={container.name} />
            <RecordViewSheetDetailRow label="Container number" value={container.containerNumber || "—"} />
            <RecordViewSheetDetailRow label="Booking number" value={container.booking} />
            <RecordViewSheetDetailRow label="Seal number" value={container.sealNumber || "—"} />
            <RecordViewSheetDetailRow label="Broker" value={container.broker || "—"} />
            <RecordViewSheetDetailRow label="Transport company" value={container.company || "—"} />
            <RecordViewSheetDetailRow label="Cost" value={formatOptionalContainerCost(container.cost)} />
            <RecordViewSheetDetailRow
              label="Barcode sequence"
              value={container.barcodeSequence > 0 ? container.barcodeSequence : "—"}
            />
            <RecordViewSheetDetailRow label="Departure date" value={formatContainerDate(container.departureDate)} />
            <RecordViewSheetDetailRow label="Arrival date" value={formatContainerDate(container.arrivalDate)} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(container.createdAt)} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(container.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit container"
          onEdit={() => onEdit(container)}
          onDelete={() => onDelete(container)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
