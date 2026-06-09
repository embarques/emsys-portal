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
  formatContainerCost,
  formatContainerDate,
  truncateContainerId,
} from "@/lib/containers/display";
import type { ContainerRecord } from "@/lib/containers/types";

type ContainerViewSheetProps = {
  container: ContainerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (container: ContainerRecord) => void;
  onDelete: (container: ContainerRecord) => void;
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
          title={container.containerCode}
          description={<span className="font-mono text-xs">{container.containerNumber}</span>}
          meta={
            <>
              <Badge variant="outline">{container.transportCompany || "No carrier"}</Badge>
              <Badge variant="secondary">{formatContainerCost(container.cost)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Shipping">
            <RecordViewSheetDetailRow label="Container ID" value={truncateContainerId(container.containerId)} />
            <RecordViewSheetDetailRow label="Container" value={container.containerCode} />
            <RecordViewSheetDetailRow label="Container number" value={container.containerNumber} />
            <RecordViewSheetDetailRow label="Booking number" value={container.bookingNumber} />
            <RecordViewSheetDetailRow label="Seal number" value={container.sealNumber || "—"} />
            <RecordViewSheetDetailRow label="Broker" value={container.broker || "—"} />
            <RecordViewSheetDetailRow label="Transport company" value={container.transportCompany || "—"} />
            <RecordViewSheetDetailRow label="Cost" value={formatContainerCost(container.cost)} />
            <RecordViewSheetDetailRow label="Departure date" value={formatContainerDate(container.departureDate)} />
            <RecordViewSheetDetailRow label="Arrival date" value={formatContainerDate(container.arrivalDate)} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(container.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={container.createdBy} />
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
