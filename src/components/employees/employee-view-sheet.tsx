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
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatEmployeeAddress,
  formatEmployeeDate,
  getEmployeeBranchBadgeClass,
  getEmployeeBranchLabel,
  getEmployeeStatusBadgeClass,
  getEmployeeStatusLabel,
  truncateEmployeeId,
} from "@/lib/employees/display";
import type { Employee } from "@/lib/employees/types";

type EmployeeViewSheetProps = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function EmployeeViewSheet({
  employee,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EmployeeViewSheetProps) {
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{employee.name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span>{employee.department}</span>
            <Badge className={getEmployeeBranchBadgeClass(employee.branch)}>
              {getEmployeeBranchLabel(employee.branch)}
            </Badge>
            <Badge className={getEmployeeStatusBadgeClass(employee.status)}>
              {getEmployeeStatusLabel(employee.status)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Employee ID" value={truncateEmployeeId(employee.employeeId)} />
            <DetailRow label="Department" value={employee.department} />
            <DetailRow label="Role" value={employee.role} />
            <DetailRow label="Branch" value={getEmployeeBranchLabel(employee.branch)} />
            <DetailRow label="Status" value={getEmployeeStatusLabel(employee.status)} />
            <DetailRow label="Date started" value={formatEmployeeDate(employee.startDate)} />
            <DetailRow
              label="Date ended"
              value={employee.endDate ? formatEmployeeDate(employee.endDate) : "—"}
            />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Address" value={employee.address || "—"} />
            <DetailRow label="City" value={employee.city || "—"} />
            <DetailRow label="State" value={employee.state || "—"} />
            <DetailRow label="Zip" value={employee.zip || "—"} />
            <DetailRow label="Full address" value={formatEmployeeAddress(employee)} />
            <DetailRow label="Phone" value={employee.phone || "—"} />
            <DetailRow label="Email" value={employee.email || "—"} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Date created" value={formatAuditDate(employee.createdAt)} />
            <DetailRow label="User created" value={employee.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(employee.updatedAt)} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(employee)}>
              <Pencil className="h-4 w-4" />
              Edit employee
            </Button>
            <Button variant="destructive" onClick={() => onDelete(employee)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
