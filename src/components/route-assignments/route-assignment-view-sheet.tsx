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
  formatRouteAssignmentDate,
  formatRouteAssignmentTimestamp,
  getEmployeeGroupRefLabel,
  getVehicleRefLabel,
  truncateObjectId,
  truncateRouteAssignmentId,
} from "@/lib/route-assignments/display";
import { formatAuditDate } from "@/lib/audit/display";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import type { RouteAssignment } from "@/lib/route-assignments/types";

type RouteAssignmentViewSheetProps = {
  assignment: RouteAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (assignment: RouteAssignment) => void;
  onDelete: (assignment: RouteAssignment) => void;
};

export function RouteAssignmentViewSheet({
  assignment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: RouteAssignmentViewSheetProps) {
  if (!assignment) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={assignment.name}
          description={<span className="font-mono text-xs">{assignment.routeAssignmentId}</span>}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Route">
            <RecordViewSheetDetailRow label="Assignment ID" value={truncateObjectId(assignment.id)} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("routeAssignmentId")}
              value={truncateRouteAssignmentId(assignment.routeAssignmentId)}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("name")} value={assignment.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("date")} value={formatRouteAssignmentDate(assignment.date)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Vehicle">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle.id")} value={assignment.vehicle.id || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle.name")} value={assignment.vehicle.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("vehicle")} value={getVehicleRefLabel(assignment.vehicle)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Employee group">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("employeeGroup.id")} value={assignment.employeeGroup.id || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("employeeGroup.name")} value={assignment.employeeGroup.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("employeeGroup")} value={getEmployeeGroupRefLabel(assignment.employeeGroup)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("createdAt")}
              value={assignment.createdAt ? formatRouteAssignmentTimestamp(assignment.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdBy")} value={assignment.createdBy || "—"} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("updatedAt")}
              value={assignment.updatedAt ? formatAuditDate(assignment.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit assignment"
          onEdit={() => onEdit(assignment)}
          onDelete={() => onDelete(assignment)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
