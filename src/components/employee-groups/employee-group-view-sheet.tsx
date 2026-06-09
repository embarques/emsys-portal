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
import { getEmployeeById } from "@/lib/employees/mock-data";
import { getEmployeeBranchLabel } from "@/lib/employees/display";
import { getEmployeeFullName, getEmployeePortalBranch } from "@/lib/employees/types";
import {
  formatEmployeeGroupDate,
  getEmployeeGroupBranchBadgeClass,
  getEmployeeGroupBranchLabel,
  truncateEmployeeGroupId,
} from "@/lib/employee-groups/display";
import { formatAuditDate } from "@/lib/audit/display";
import type { EmployeeGroup } from "@/lib/employee-groups/types";

type EmployeeGroupViewSheetProps = {
  group: EmployeeGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (group: EmployeeGroup) => void;
  onDelete: (group: EmployeeGroup) => void;
};

export function EmployeeGroupViewSheet({
  group,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EmployeeGroupViewSheetProps) {
  if (!group) return null;

  const members = group.employeeIds.map((employeeId) => getEmployeeById(employeeId)).filter(Boolean);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title="Employee group"
          description={<span className="font-mono text-xs">{group.employeeGroupId}</span>}
          meta={
            <Badge className={getEmployeeGroupBranchBadgeClass(group.branch)}>
              {getEmployeeGroupBranchLabel(group.branch)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Group">
            <RecordViewSheetDetailRow label="Group ID" value={truncateEmployeeGroupId(group.employeeGroupId)} />
            <RecordViewSheetDetailRow label="Branch" value={getEmployeeGroupBranchLabel(group.branch)} />
            <RecordViewSheetDetailRow label="Date created" value={formatEmployeeGroupDate(group.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={group.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(group.updatedAt)} />
            <RecordViewSheetDetailRow label="Employees" value={group.employeeIds.length} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={`Members (${members.length})`} padding="relaxed">
            {members.length > 0 ? (
              <ul className="space-y-3">
                {members.map((employee) => (
                  <li
                    key={employee!.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{getEmployeeFullName(employee!)}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee!.department} · {employee!.title}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {getEmployeeBranchLabel(getEmployeePortalBranch(employee!))}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No employees assigned.</p>
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit group" onEdit={() => onEdit(group)} onDelete={() => onDelete(group)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
