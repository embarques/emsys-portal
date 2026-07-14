"use client";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import {
  formatRouteDate,
  formatRouteTimestamp,
  getRouteEmployeesLabel,
  getVehicleRefLabel,
  truncateObjectId,
  truncateRouteId,
} from "@/lib/route-manager/display";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import type { Route } from "@/lib/route-manager/types";

type RouteViewSheetProps = {
  assignment: Route | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (assignment: Route) => void;
  onDelete: (assignment: Route) => void;
};

export function RouteViewSheet({
  assignment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: RouteViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  if (!assignment) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={assignment.name}
          description={<span className="font-mono text-xs">{assignment.routeId}</span>}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("routes.viewSheet.sections.route")}>
            <RecordViewSheetDetailRow
              label={t("routes.viewSheet.recordId")}
              value={truncateObjectId(assignment.id)}
            />
            <RecordViewSheetDetailRow
              label={t("routes.routeDetails.routeId")}
              value={truncateRouteId(assignment.routeId)}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.name")}
              value={assignment.name}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.date")}
              value={formatRouteDate(assignment.date)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("routes.viewSheet.sections.vehicle")}>
            <RecordViewSheetDetailRow
              label={t("routes.viewSheet.vehicleId")}
              value={assignment.vehicle.id || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.vehicle")}
              value={assignment.vehicle.name || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.routeDetails.vehicle")}
              value={getVehicleRefLabel(assignment.vehicle)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("routes.viewSheet.sections.employees")}>
            <RecordViewSheetDetailRow
              label={t("routes.columns.employees")}
              value={getRouteEmployeesLabel(assignment.employees)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("routes.viewSheet.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("routes.columns.createdAt")}
              value={assignment.createdAt ? formatRouteTimestamp(assignment.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.createdBy")}
              value={assignment.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.updatedAt")}
              value={assignment.updatedAt ? formatAuditDateTime(assignment.updatedAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.updatedBy")}
              value={assignment.updatedBy || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("routes.viewSheet.editLabel")}
          onEdit={() => onEdit(assignment)}
          onDelete={() => onDelete(assignment)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
