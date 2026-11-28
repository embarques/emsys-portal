"use client";

import { Info, Network } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import type { EmployeeDepartment } from "@/lib/employee-departments/types";

type EmployeeDepartmentViewSheetProps = {
  department: EmployeeDepartment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (department: EmployeeDepartment) => void;
  onDelete: (department: EmployeeDepartment) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function EmployeeDepartmentViewSheet({
  department,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: EmployeeDepartmentViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  if (!department) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={Network}
          eyebrow={t("employeeDepartments.entity")}
          title={department.name}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("employeeDepartments.view.sections.details")} icon={Network}>
            <RecordViewSheetDetailRow label={t("employeeDepartments.name")} value={department.name} />
            <RecordViewSheetDetailRow
              label={t("employeeDepartments.active")}
              value={t(department.active ? "employeeDepartments.active" : "employeeDepartments.inactive")}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employeeDepartments.view.sections.audit")} icon={Info}>
            <RecordViewSheetDetailRow label={t("employeeDepartments.view.recordId")} value={department.id} />
            <RecordViewSheetDetailRow
              label={t("common.apiColumns.createdAt")}
              value={department.createdAt ? formatAuditDateTime(department.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.apiColumns.updatedAt")}
              value={department.updatedAt ? formatAuditDateTime(department.updatedAt) : dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("employeeDepartments.view.edit")}
          onEdit={canEdit ? () => onEdit(department) : undefined}
          onDelete={canDelete ? () => onDelete(department) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
