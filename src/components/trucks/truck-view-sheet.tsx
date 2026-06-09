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
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
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
          <RecordViewSheetSection title="Details">
            <RecordViewSheetDetailRow label="Truck ID" value={truck.truckId} />
            <RecordViewSheetDetailRow label="VIN" value={truck.vin} />
            <RecordViewSheetDetailRow label="Year" value={truck.year} />
            <RecordViewSheetDetailRow label="Fuel type" value={getFuelTypeLabel(truck.fuelType)} />
            <RecordViewSheetDetailRow label="Branch" value={getBranchLabel(truck.branch)} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(truck.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={truck.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(truck.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit truck" onEdit={() => onEdit(truck)} onDelete={() => onDelete(truck)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
