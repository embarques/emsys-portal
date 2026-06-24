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
  formatVehicleDate,
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
  truncateObjectId,
  truncateVehicleId,
} from "@/lib/vehicles/display";
import type { Vehicle } from "@/lib/vehicles/types";

type VehicleViewSheetProps = {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
};

export function VehicleViewSheet({ vehicle, open, onOpenChange, onEdit, onDelete }: VehicleViewSheetProps) {
  if (!vehicle) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={vehicle.name}
          description={<span className="font-mono text-xs">{vehicle.truckId}</span>}
          meta={
            <>
              <Badge className={getFuelTypeBadgeClass(vehicle.fuelType)}>{getFuelTypeLabel(vehicle.fuelType)}</Badge>
              <Badge className={getBranchBadgeClass(vehicle.branch)}>{getBranchLabel(vehicle.branch)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Vehicle">
            <RecordViewSheetDetailRow label="Record ID" value={truncateObjectId(vehicle.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("truckId")} value={truncateVehicleId(vehicle.truckId)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("name")} value={vehicle.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vin")} value={vehicle.vin} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("year")} value={vehicle.year} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("fuelType")} value={getFuelTypeLabel(vehicle.fuelType)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch")} value={vehicle.branch || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("inspectionDate")} value={formatVehicleDate(vehicle.inspectionDate)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("registrationDate")} value={formatVehicleDate(vehicle.registrationDate)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label="createdAt"
              value={vehicle.createdAt ? formatAuditDate(vehicle.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdBy")} value={vehicle.createdBy || "—"} />
            <RecordViewSheetDetailRow
              label="updatedAt"
              value={vehicle.updatedAt ? formatAuditDate(vehicle.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit vehicle" onEdit={() => onEdit(vehicle)} onDelete={() => onDelete(vehicle)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
