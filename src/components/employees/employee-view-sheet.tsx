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

export function EmployeeViewSheet({
  employee,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EmployeeViewSheetProps) {
  if (!employee) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={employee.name}
          description={employee.department}
          meta={
            <>
              <Badge className={getEmployeeBranchBadgeClass(employee)}>
                {formatEmployeeBranchLabel(employee)}
              </Badge>
              <Badge className={getEmployeeActiveBadgeClass(employee.active)}>
                {getEmployeeActiveLabel(employee.active)}
              </Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Profile">
            <RecordViewSheetDetailRow label="ID" value={formatEmployeeId(employee.id)} />
            <RecordViewSheetDetailRow label="Department" value={employee.department} />
            <RecordViewSheetDetailRow label="Title" value={employee.title} />
            <RecordViewSheetDetailRow label="Branch" value={formatEmployeeBranchLabel(employee)} />
            <RecordViewSheetDetailRow label="Active" value={getEmployeeActiveLabel(employee.active)} />
            <RecordViewSheetDetailRow label="Cost" value={formatEmployeeMoney(employee.cost)} />
            <RecordViewSheetDetailRow
              label="User"
              value={employee.user?.userName || (employee.user?.id ? String(employee.user.id) : "—")}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="Address 1" value={employee.address.address1 || "—"} />
            <RecordViewSheetDetailRow label="Address 2" value={employee.address.address2 || "—"} />
            <RecordViewSheetDetailRow label="Apartment" value={employee.address.apartment || "—"} />
            <RecordViewSheetDetailRow label="City" value={employee.address.city || "—"} />
            <RecordViewSheetDetailRow label="State" value={employee.address.state || "—"} />
            <RecordViewSheetDetailRow label="Zipcode" value={employee.address.zipcode || "—"} />
            <RecordViewSheetDetailRow label="Country" value={employee.address.country || "—"} />
            <RecordViewSheetDetailRow label="Full address" value={formatEmployeeAddress(employee)} />
            <RecordViewSheetDetailRow label="Phone 1" value={employee.phone1 || "—"} />
            <RecordViewSheetDetailRow label="Phone 2" value={employee.phone2 || "—"} />
            <RecordViewSheetDetailRow label="Phones" value={formatEmployeePhones(employee)} />
            <RecordViewSheetDetailRow label="Email" value={employee.email || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Loans">
            <RecordViewSheetDetailRow label="Loan amount owed" value={formatEmployeeMoney(employee.loanAmountOwed)} />
            <RecordViewSheetDetailRow
              label="Loan balance updated"
              value={employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : "—"}
            />
            <RecordViewSheetDetailRow label="Total loan given" value={formatEmployeeMoney(employee.totalLoanGiven)} />
            <RecordViewSheetDetailRow
              label="Total payment received"
              value={formatEmployeeMoney(employee.totalPaymentReceived)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label="Created at"
              value={employee.createdAt ? formatAuditDate(employee.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="Updated at"
              value={employee.updatedAt ? formatAuditDate(employee.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit employee"
          onEdit={() => onEdit(employee)}
          onDelete={() => onDelete(employee)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
