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
import { useTranslation } from "@/lib/i18n";
import {
  formatVehicleDate,
  getBranchBadgeClass,
  getFuelTypeBadgeClass,
  getVehicleActiveBadgeClass,
  truncateObjectId,
  truncateVehicleId,
} from "@/lib/vehicles/display";
import { useVehicleLabels } from "@/lib/vehicles/hooks/use-vehicle-labels";
import type { Vehicle } from "@/lib/vehicles/types";

type VehicleViewSheetProps = {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
};

export function VehicleViewSheet({ vehicle, open, onOpenChange, onEdit, onDelete }: VehicleViewSheetProps) {
  const { t } = useTranslation();
  const vehicleLabels = useVehicleLabels();

  if (!vehicle) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={vehicle.name}
          description={<span className="font-mono text-xs">{vehicle.vehicleId}</span>}
          meta={
            <>
              <Badge className={getFuelTypeBadgeClass(vehicle.fuelType)}>
                {vehicleLabels.fuelType(vehicle.fuelType)}
              </Badge>
              <Badge className={getBranchBadgeClass(vehicle.branch.code)}>
                {vehicleLabels.branch(vehicle.branch.code)}
              </Badge>
              <Badge className={getVehicleActiveBadgeClass(vehicle.active)}>
                {vehicleLabels.active(vehicle.active)}
              </Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("vehicles.view.sections.vehicle")}>
            <RecordViewSheetDetailRow label={t("vehicles.view.recordId")} value={truncateObjectId(vehicle.id)} />
            <RecordViewSheetDetailRow
              label={t("vehicles.view.vehicleId")}
              value={truncateVehicleId(vehicle.vehicleId)}
            />
            <RecordViewSheetDetailRow label={t("vehicles.columns.name")} value={vehicle.name} />
            <RecordViewSheetDetailRow label={t("vehicles.columns.vin")} value={vehicle.vin} />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.licensePlate")}
              value={vehicle.licensePlate || dash}
            />
            <RecordViewSheetDetailRow label={t("vehicles.columns.year")} value={vehicle.year} />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.fuelType")}
              value={vehicleLabels.fuelType(vehicle.fuelType)}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.branch")}
              value={vehicleLabels.branch(vehicle.branch.code)}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.status")}
              value={vehicleLabels.active(vehicle.active)}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.inspectionDate")}
              value={formatVehicleDate(vehicle.inspectionDate)}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.registrationDate")}
              value={formatVehicleDate(vehicle.registrationDate)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("vehicles.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.createdAt")}
              value={vehicle.createdAt ? formatAuditDate(vehicle.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.createdBy")}
              value={vehicle.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.updatedAt")}
              value={vehicle.updatedAt ? formatAuditDate(vehicle.updatedAt) : dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("vehicles.view.edit")}
          onEdit={() => onEdit(vehicle)}
          onDelete={() => onDelete(vehicle)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
