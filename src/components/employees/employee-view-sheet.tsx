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
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import {
  formatRecordPhoneTypeLabel,
  getOrderedRecordPhones,
} from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import {
  formatEmployeeAddress,
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeeUserLabel,
  getEmployeeActiveBadgeClass,
  getEmployeeBranchBadgeClass,
} from "@/lib/employees/display";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
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
  const { t } = useTranslation();
  const employeeLabels = useEmployeeLabels();

  if (!employee) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={employee.name}
          description={employeeLabels.department(employee.department)}
          meta={
            <>
              <Badge className={getEmployeeBranchBadgeClass(employee)}>
                {employeeLabels.branchLabel(employee)}
              </Badge>
              <Badge className={getEmployeeActiveBadgeClass(employee.active)}>
                {employeeLabels.active(employee.active)}
              </Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("employees.view.sections.employee")}>
            <RecordViewSheetDetailRow
              label={t("employees.view.employeeId")}
              value={formatEmployeeId(employee.id)}
            />
            <RecordViewSheetDetailRow label={t("employees.columns.name")} value={employee.name} />
            <RecordViewSheetDetailRow
              label={t("employees.columns.title")}
              value={employeeLabels.title(employee.title) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.department")}
              value={employeeLabels.department(employee.department) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.active")}
              value={employeeLabels.active(employee.active)}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.startDate")}
              value={employee.startDate ? formatAuditDate(employee.startDate) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.endDate")}
              value={employee.endDate ? formatAuditDate(employee.endDate) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.cost")}
              value={formatEmployeeMoney(employee.cost)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.branch")}>
            <RecordViewSheetDetailRow
              label={t("employees.view.branchId")}
              value={employee.branch.id > 0 ? String(employee.branch.id) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.branch.name")}
              value={employee.branch.name || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.branch.code")}
              value={employee.branch.code || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.branch")}
              value={employeeLabels.branchLabel(employee)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.contact")}>
            {getOrderedRecordPhones(employee.phones).length === 0 ? (
              <RecordViewSheetDetailRow label={t("employees.columns.phone")} value={dash} />
            ) : (
              getOrderedRecordPhones(employee.phones).map((phone, index) => (
                <PhoneActionRow
                  key={`phone-${index}`}
                  label={
                    phone.isPrimary
                      ? t("employees.view.phonePrimary", {
                          type: formatRecordPhoneTypeLabel(phone.type),
                        })
                      : formatRecordPhoneTypeLabel(phone.type)
                  }
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                />
              ))
            )}
            <RecordViewSheetDetailRow
              label={t("employees.columns.email")}
              value={employee.email || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.address")}>
            <RecordViewSheetDetailRow
              label={t("employees.columns.address.address1")}
              value={employee.address.address1 || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.form.fields.address2")}
              value={employee.address.address2 || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.form.fields.apartment")}
              value={employee.address.apartment || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.address.city")}
              value={employee.address.city || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.address.state")}
              value={employee.address.state || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.form.fields.zipcode")}
              value={employee.address.zipcode || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.address.country")}
              value={employee.address.country || dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.form.sections.address")}
              value={formatEmployeeAddress(employee)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.loans")}>
            <RecordViewSheetDetailRow
              label={t("employees.columns.totalLoanGiven")}
              value={formatEmployeeMoney(employee.totalLoanGiven)}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.totalPaymentReceived")}
              value={formatEmployeeMoney(employee.totalPaymentReceived)}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.loanAmountOwed")}
              value={formatEmployeeMoney(employee.loanAmountOwed)}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.loanBalanceUpdated")}
              value={employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : dash}
            />
          </RecordViewSheetSection>

          {employee.user ? (
            <RecordViewSheetSection title={t("employees.view.sections.user")}>
              <RecordViewSheetDetailRow
                label={t("employees.columns.user")}
                value={formatEmployeeUserLabel(employee)}
              />
              <RecordViewSheetDetailRow
                label={t("employees.columns.user.id")}
                value={String(employee.user.id)}
              />
              <RecordViewSheetDetailRow
                label={t("employees.columns.user.name")}
                value={employee.user.name || dash}
              />
              <RecordViewSheetDetailRow label={t("employees.columns.email")} value={employee.user.email || dash} />
              <RecordViewSheetDetailRow
                label={t("employees.columns.active")}
                value={String(employee.user.active)}
              />
              <RecordViewSheetDetailRow label="UID" value={employee.user.uid || dash} />
              <RecordViewSheetDetailRow
                label={t("employees.form.fields.title")}
                value={employee.user.role.name || dash}
              />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("employees.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("employees.columns.createdAt")}
              value={employee.createdAt ? formatAuditDate(employee.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.updatedAt")}
              value={employee.updatedAt ? formatAuditDate(employee.updatedAt) : dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("employees.view.edit")}
          onEdit={() => onEdit(employee)}
          onDelete={() => onDelete(employee)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
