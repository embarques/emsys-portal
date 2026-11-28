"use client";

import { Car, Info } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { formatVehicleDate } from "@/lib/vehicles/display";
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
          icon={Car}
          eyebrow={t("vehicles.entity")}
          title={vehicle.name}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("vehicles.view.sections.vehicle")} icon={Car}>
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

          <RecordViewSheetSection title={t("vehicles.view.sections.audit")} icon={Info}>
            <RecordViewSheetDetailRow label={t("vehicles.view.recordId")} value={vehicle.id} />
            <RecordViewSheetDetailRow label={t("vehicles.view.vehicleId")} value={vehicle.vehicleId} />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.createdAt")}
              value={vehicle.createdAt ? formatAuditDateTime(vehicle.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.createdBy")}
              value={vehicle.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("vehicles.columns.updatedAt")}
              value={vehicle.updatedAt ? formatAuditDateTime(vehicle.updatedAt) : dash}
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
