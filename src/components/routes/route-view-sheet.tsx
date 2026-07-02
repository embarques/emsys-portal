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
} from "@/lib/routes/display";
import { formatAuditDate } from "@/lib/audit/display";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import type { Route } from "@/lib/routes/types";

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
  if (!assignment) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={assignment.name}
          description={<span className="font-mono text-xs">{assignment.routeId}</span>}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Route">
            <RecordViewSheetDetailRow label="Route ID" value={truncateObjectId(assignment.id)} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("routeId")}
              value={truncateRouteId(assignment.routeId)}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("name")} value={assignment.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("date")} value={formatRouteDate(assignment.date)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Vehicle">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle.id")} value={assignment.vehicle.id || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle.name")} value={assignment.vehicle.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle")} value={getVehicleRefLabel(assignment.vehicle)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Employees">
            <RecordViewSheetDetailRow label="Employees" value={getRouteEmployeesLabel(assignment.employees)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("createdAt")}
              value={assignment.createdAt ? formatRouteTimestamp(assignment.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdBy")} value={assignment.createdBy || "—"} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("updatedAt")}
              value={assignment.updatedAt ? formatAuditDate(assignment.updatedAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="Updated by"
              value={assignment.updatedBy || "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit route"
          onEdit={() => onEdit(assignment)}
          onDelete={() => onDelete(assignment)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
