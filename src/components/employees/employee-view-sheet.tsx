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
  formatEmployeeBranchLabel,
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeePhones,
  getEmployeeActiveBadgeClass,
  getEmployeeActiveLabel,
  getEmployeeBranchBadgeClass,
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
            <Badge className={getEmployeeBranchBadgeClass(employee)}>
              {formatEmployeeBranchLabel(employee)}
            </Badge>
            <Badge className={getEmployeeActiveBadgeClass(employee.active)}>
              {getEmployeeActiveLabel(employee.active)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="ID" value={formatEmployeeId(employee.id)} />
            <DetailRow label="Department" value={employee.department} />
            <DetailRow label="Title" value={employee.title} />
            <DetailRow label="Branch" value={formatEmployeeBranchLabel(employee)} />
            <DetailRow label="Active" value={getEmployeeActiveLabel(employee.active)} />
            <DetailRow label="Cost" value={formatEmployeeMoney(employee.cost)} />
            <DetailRow
              label="User"
              value={employee.user?.userName || (employee.user?.id ? String(employee.user.id) : "—")}
            />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Address 1" value={employee.address.address1 || "—"} />
            <DetailRow label="Address 2" value={employee.address.address2 || "—"} />
            <DetailRow label="Apartment" value={employee.address.apartment || "—"} />
            <DetailRow label="City" value={employee.address.city || "—"} />
            <DetailRow label="State" value={employee.address.state || "—"} />
            <DetailRow label="Zipcode" value={employee.address.zipcode || "—"} />
            <DetailRow label="Country" value={employee.address.country || "—"} />
            <DetailRow label="Full address" value={formatEmployeeAddress(employee)} />
            <DetailRow label="Phone 1" value={employee.phone1 || "—"} />
            <DetailRow label="Phone 2" value={employee.phone2 || "—"} />
            <DetailRow label="Phones" value={formatEmployeePhones(employee)} />
            <DetailRow label="Email" value={employee.email || "—"} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Loan amount owed" value={formatEmployeeMoney(employee.loanAmountOwed)} />
            <DetailRow
              label="Loan balance updated"
              value={employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : "—"}
            />
            <DetailRow label="Total loan given" value={formatEmployeeMoney(employee.totalLoanGiven)} />
            <DetailRow
              label="Total payment received"
              value={formatEmployeeMoney(employee.totalPaymentReceived)}
            />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Created at" value={employee.createdAt ? formatAuditDate(employee.createdAt) : "—"} />
            <DetailRow label="Updated at" value={employee.updatedAt ? formatAuditDate(employee.updatedAt) : "—"} />
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
