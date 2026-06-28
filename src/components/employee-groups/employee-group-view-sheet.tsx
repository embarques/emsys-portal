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
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import {
  formatEmployeeGroupDate,
  getEmployeeGroupBranchBadgeClass,
  getEmployeeGroupBranchLabel,
} from "@/lib/employee-groups/display";

type EmployeeGroupViewSheetProps = {
  group: EmployeeGroupOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (group: EmployeeGroupOption) => void;
};

export function EmployeeGroupViewSheet({ group, open, onOpenChange, onDelete }: EmployeeGroupViewSheetProps) {
  if (!group) return null;

  const members = group.employees;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={group.name}
          description={<span className="font-mono text-xs">{group.employeeGroupId}</span>}
          meta={
            group.branch ? (
              <Badge className={getEmployeeGroupBranchBadgeClass(group.branch)}>
                {getEmployeeGroupBranchLabel(group.branch)}
              </Badge>
            ) : null
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Group">
            <RecordViewSheetDetailRow label="Name" value={group.name} />
            {group.branch ? (
              <RecordViewSheetDetailRow label="Branch" value={getEmployeeGroupBranchLabel(group.branch)} />
            ) : null}
            <RecordViewSheetDetailRow label="Employees" value={group.employees.length} />
            {group.createdAt ? (
              <RecordViewSheetDetailRow label="Date created" value={formatEmployeeGroupDate(group.createdAt)} />
            ) : null}
            {group.createdBy ? (
              <RecordViewSheetDetailRow label="User created" value={group.createdBy} />
            ) : null}
            {group.updatedAt ? (
              <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(group.updatedAt)} />
            ) : null}
            {group.updatedBy ? (
              <RecordViewSheetDetailRow label="User modified" value={group.updatedBy} />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={`Members (${members.length})`} padding="relaxed">
            {members.length > 0 ? (
              <ul className="space-y-3">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-4 py-3"
                  >
                    <p className="font-medium">{member.name}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No employees assigned.</p>
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        {onDelete ? (
          <RecordViewSheetActions deleteLabel="Delete group" onDelete={() => onDelete(group)} />
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
