"use client";

import {
  Building2,
  Info,
  KeyRound,
  MapPin,
  Phone,
  User as UserIcon,
  Wallet,
} from "lucide-react";

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
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import {
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeeUserLabel,
  getEmployeeBranchBadgeClass,
  hasEmployeeAddress,
  toEmployeeCoreAddress,
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
  const department = employeeLabels.department(employee.department).trim();

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={employee.name.trim() || dash}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              {department ? (
                <span className="text-sm text-muted-foreground">{department}</span>
              ) : null}
              <Badge variant="outline" className={getEmployeeBranchBadgeClass(employee)}>
                {employeeLabels.branchLabel(employee)}
              </Badge>
              <Badge
                variant="outline"
                className={
                  employee.active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted text-muted-foreground"
                }
              >
                {employeeLabels.active(employee.active)}
              </Badge>
            </div>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("employees.view.sections.employee")} icon={UserIcon}>
            <RecordViewSheetDetailRow
              label={t("employees.view.employeeId")}
              value={formatEmployeeId(employee.id)}
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

          <RecordViewSheetSection title={t("employees.view.sections.branch")} icon={Building2}>
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

          <RecordViewSheetSection title={t("employees.view.sections.contact")} icon={Phone}>
            {getOrderedRecordPhones(employee.phones).length === 0 ? (
              <RecordViewSheetDetailRow label={t("employees.columns.phone")} value={dash} />
            ) : (
              getOrderedRecordPhones(employee.phones).map((phone, index) => (
                <PhoneActionRow
                  key={`phone-${index}`}
                  label={t(`phones.types.${phone.type}`)}
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                  isPrimary={phone.isPrimary}
                />
              ))
            )}
            <RecordViewSheetDetailRow
              label={t("employees.columns.email")}
              value={employee.email || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.address")} icon={MapPin}>
            {hasEmployeeAddress(employee) ? (
              <AddressActionRow
                label=""
                address={toEmployeeCoreAddress(employee)}
                isPrimary
              />
            ) : (
              <RecordViewSheetDetailRow
                label={t("employees.form.sections.address")}
                value={dash}
              />
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employees.view.sections.loans")} icon={Wallet}>
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
            <RecordViewSheetSection title={t("employees.view.sections.user")} icon={KeyRound}>
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

          <RecordViewSheetSection title={t("employees.view.sections.audit")} icon={Info}>
            <RecordViewSheetDetailRow
              label={t("employees.columns.createdAt")}
              value={employee.createdAt ? formatAuditDateTime(employee.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("employees.columns.updatedAt")}
              value={employee.updatedAt ? formatAuditDateTime(employee.updatedAt) : dash}
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
