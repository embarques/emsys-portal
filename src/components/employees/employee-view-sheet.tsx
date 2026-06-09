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
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import {
  formatEmployeeAddress,
  formatEmployeeBranchLabel,
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeePhones,
  formatEmployeeUserLabel,
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
          <RecordViewSheetSection title="Employee">
            <RecordViewSheetDetailRow label="id" value={formatEmployeeId(employee.id)} />
            <RecordViewSheetDetailRow label="name" value={employee.name} />
            <RecordViewSheetDetailRow label="title" value={employee.title || "—"} />
            <RecordViewSheetDetailRow label="department" value={employee.department || "—"} />
            <RecordViewSheetDetailRow label="active" value={getEmployeeActiveLabel(employee.active)} />
            <RecordViewSheetDetailRow
              label="startDate"
              value={employee.startDate ? formatAuditDate(employee.startDate) : "—"}
            />
            <RecordViewSheetDetailRow
              label="endDate"
              value={employee.endDate ? formatAuditDate(employee.endDate) : "—"}
            />
            <RecordViewSheetDetailRow label="cost" value={formatEmployeeMoney(employee.cost)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label="branch.id" value={employee.branch.id > 0 ? String(employee.branch.id) : "—"} />
            <RecordViewSheetDetailRow label="branch.name" value={employee.branch.name || "—"} />
            <RecordViewSheetDetailRow label="branch.code" value={employee.branch.code || "—"} />
            <RecordViewSheetDetailRow label="branch" value={formatEmployeeBranchLabel(employee)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="phone1" value={formatPhoneDisplayOrDash(employee.phone1)} />
            <RecordViewSheetDetailRow label="phone2" value={formatPhoneDisplayOrDash(employee.phone2)} />
            <RecordViewSheetDetailRow label="phones" value={formatEmployeePhones(employee)} />
            <RecordViewSheetDetailRow label="email" value={employee.email || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Address">
            <RecordViewSheetDetailRow label="address.address1" value={employee.address.address1 || "—"} />
            <RecordViewSheetDetailRow label="address.address2" value={employee.address.address2 || "—"} />
            <RecordViewSheetDetailRow label="address.apartment" value={employee.address.apartment || "—"} />
            <RecordViewSheetDetailRow label="address.city" value={employee.address.city || "—"} />
            <RecordViewSheetDetailRow label="address.state" value={employee.address.state || "—"} />
            <RecordViewSheetDetailRow label="address.zipcode" value={employee.address.zipcode || "—"} />
            <RecordViewSheetDetailRow label="address.country" value={employee.address.country || "—"} />
            <RecordViewSheetDetailRow label="address" value={formatEmployeeAddress(employee)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Loans">
            <RecordViewSheetDetailRow label="totalLoanGiven" value={formatEmployeeMoney(employee.totalLoanGiven)} />
            <RecordViewSheetDetailRow
              label="totalPaymentReceived"
              value={formatEmployeeMoney(employee.totalPaymentReceived)}
            />
            <RecordViewSheetDetailRow label="loanAmountOwed" value={formatEmployeeMoney(employee.loanAmountOwed)} />
            <RecordViewSheetDetailRow
              label="loanBalanceUpdated"
              value={employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : "—"}
            />
          </RecordViewSheetSection>

          {employee.user ? (
            <RecordViewSheetSection title="User">
              <RecordViewSheetDetailRow label="user" value={formatEmployeeUserLabel(employee)} />
              <RecordViewSheetDetailRow label="user.id" value={String(employee.user.id)} />
              <RecordViewSheetDetailRow label="user.userName" value={employee.user.userName || "—"} />
              <RecordViewSheetDetailRow label="user.fullName" value={employee.user.fullName || "—"} />
              <RecordViewSheetDetailRow label="user.email" value={employee.user.email || "—"} />
              <RecordViewSheetDetailRow label="user.active" value={String(employee.user.active)} />
              <RecordViewSheetDetailRow label="user.uid" value={employee.user.uid || "—"} />
              <RecordViewSheetDetailRow label="user.type" value={employee.user.type || "—"} />
              <RecordViewSheetDetailRow label="user.role.name" value={employee.user.role.name || "—"} />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label="createdAt"
              value={employee.createdAt ? formatAuditDate(employee.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="updatedAt"
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
