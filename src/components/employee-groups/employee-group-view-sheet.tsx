"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getEmployeeById } from "@/lib/employees/mock-data";
import { getEmployeeBranchLabel } from "@/lib/employees/display";
import { getEmployeeFullName } from "@/lib/employees/types";
import { formatEmployeeGroupDate, getEmployeeGroupBranchBadgeClass, getEmployeeGroupBranchLabel, truncateEmployeeGroupId } from "@/lib/employee-groups/display";
import { formatAuditDate } from "@/lib/audit/display";
import type { EmployeeGroup } from "@/lib/employee-groups/types";

type EmployeeGroupViewSheetProps = {
  group: EmployeeGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (group: EmployeeGroup) => void;
  onDelete: (group: EmployeeGroup) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function EmployeeGroupViewSheet({
  group,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EmployeeGroupViewSheetProps) {
  if (!group) return null;

  const members = group.employeeIds
    .map((employeeId) => getEmployeeById(employeeId))
    .filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Employee group</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span>{group.employeeGroupId}</span>
            <Badge className={getEmployeeGroupBranchBadgeClass(group.branch)}>
              {getEmployeeGroupBranchLabel(group.branch)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Group ID" value={truncateEmployeeGroupId(group.employeeGroupId)} />
            <DetailRow label="Branch" value={getEmployeeGroupBranchLabel(group.branch)} />
            <DetailRow label="Date created" value={formatEmployeeGroupDate(group.createdAt)} />
            <DetailRow label="User created" value={group.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(group.updatedAt)} />
            <DetailRow label="Employees" value={group.employeeIds.length} />
          </div>

          <div className="mt-4 rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Group members ({members.length})
            </p>
            {members.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {members.map((employee) => (
                  <li key={employee!.employeeId} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{getEmployeeFullName(employee!)}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee!.department} · {employee!.role}
                      </p>
                    </div>
                    <Badge variant="outline">{getEmployeeBranchLabel(employee!.branch)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No employees assigned.</p>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(group)}>
              <Pencil className="h-4 w-4" />
              Edit group
            </Button>
            <Button variant="destructive" onClick={() => onDelete(group)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
