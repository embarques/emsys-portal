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
  getEmployeeGroupLabel,
  getTruckName,
  truncateRouteAssignmentId,
} from "@/lib/route-assignments/display";
import { formatAuditDate } from "@/lib/audit/display";
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
          <RecordViewSheetSection title="Assignment">
            <RecordViewSheetDetailRow
              label="Assignment ID"
              value={truncateRouteAssignmentId(assignment.routeAssignmentId)}
            />
            <RecordViewSheetDetailRow label="Assignment date" value={formatRouteAssignmentDate(assignment.date)} />
            <RecordViewSheetDetailRow label="Truck" value={getTruckName(assignment.truckId)} />
            <RecordViewSheetDetailRow label="Employee group" value={getEmployeeGroupLabel(assignment.employeeGroupId)} />
            <RecordViewSheetDetailRow label="Date created" value={formatRouteAssignmentTimestamp(assignment.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={assignment.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(assignment.updatedAt)} />
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
