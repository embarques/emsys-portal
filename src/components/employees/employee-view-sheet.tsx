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
import { formatTableColumnLabel } from "@/lib/table/column-labels";
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
            <RecordViewSheetDetailRow label="Employee ID" value={formatEmployeeId(employee.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("name")} value={employee.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("title")} value={employee.title || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("department")} value={employee.department || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("active")} value={getEmployeeActiveLabel(employee.active)} />
            <RecordViewSheetDetailRow
              label="startDate"
              value={employee.startDate ? formatAuditDate(employee.startDate) : "—"}
            />
            <RecordViewSheetDetailRow
              label="endDate"
              value={employee.endDate ? formatAuditDate(employee.endDate) : "—"}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("cost")} value={formatEmployeeMoney(employee.cost)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.id")} value={employee.branch.id > 0 ? String(employee.branch.id) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.name")} value={employee.branch.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.code")} value={employee.branch.code || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch")} value={formatEmployeeBranchLabel(employee)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("phone1")} value={formatPhoneDisplayOrDash(employee.phone1)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("phone2")} value={formatPhoneDisplayOrDash(employee.phone2)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("phones")} value={formatEmployeePhones(employee)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("email")} value={employee.email || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Address">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.address1")} value={employee.address.address1 || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.address2")} value={employee.address.address2 || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.apartment")} value={employee.address.apartment || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.city")} value={employee.address.city || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.state")} value={employee.address.state || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.zipcode")} value={employee.address.zipcode || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address.country")} value={employee.address.country || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("address")} value={formatEmployeeAddress(employee)} />
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
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user")} value={formatEmployeeUserLabel(employee)} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.id")} value={String(employee.user.id)} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.userName")} value={employee.user.userName || "—"} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.fullName")} value={employee.user.fullName || "—"} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.email")} value={employee.user.email || "—"} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.active")} value={String(employee.user.active)} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.uid")} value={employee.user.uid || "—"} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.type")} value={employee.user.type || "—"} />
              <RecordViewSheetDetailRow label={formatTableColumnLabel("user.role.name")} value={employee.user.role.name || "—"} />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("createdAt")}
              value={employee.createdAt ? formatAuditDate(employee.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("updatedAt")}
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
