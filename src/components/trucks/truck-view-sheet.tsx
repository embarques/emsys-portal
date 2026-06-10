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
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import {
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
  truncateObjectId,
  truncateTruckId,
} from "@/lib/trucks/display";
import type { Truck } from "@/lib/trucks/types";

type TruckViewSheetProps = {
  truck: Truck | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (truck: Truck) => void;
  onDelete: (truck: Truck) => void;
};

export function TruckViewSheet({ truck, open, onOpenChange, onEdit, onDelete }: TruckViewSheetProps) {
  if (!truck) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={truck.name}
          description={<span className="font-mono text-xs">{truck.truckId}</span>}
          meta={
            <>
              <Badge className={getFuelTypeBadgeClass(truck.fuelType)}>{getFuelTypeLabel(truck.fuelType)}</Badge>
              <Badge className={getBranchBadgeClass(truck.branch)}>{getBranchLabel(truck.branch)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Truck">
            <RecordViewSheetDetailRow label="Record ID" value={truncateObjectId(truck.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("truckId")} value={truncateTruckId(truck.truckId)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("name")} value={truck.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vin")} value={truck.vin} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("year")} value={truck.year} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("fuelType")} value={getFuelTypeLabel(truck.fuelType)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch")} value={truck.branch || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label="createdAt"
              value={truck.createdAt ? formatAuditDate(truck.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdBy")} value={truck.createdBy || "—"} />
            <RecordViewSheetDetailRow
              label="updatedAt"
              value={truck.updatedAt ? formatAuditDate(truck.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit truck" onEdit={() => onEdit(truck)} onDelete={() => onDelete(truck)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
