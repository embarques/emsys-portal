"use client";

import { Briefcase, Info } from "lucide-react";

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
import type { EmployeeTitle } from "@/lib/employee-titles/types";

type EmployeeTitleViewSheetProps = {
  title: EmployeeTitle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (title: EmployeeTitle) => void;
  onDelete: (title: EmployeeTitle) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function EmployeeTitleViewSheet({
  title,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: EmployeeTitleViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  if (!title) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={Briefcase}
          eyebrow={t("employeeTitles.entity")}
          title={title.name}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("employeeTitles.view.sections.details")} icon={Briefcase}>
            <RecordViewSheetDetailRow label={t("employeeTitles.name")} value={title.name} />
            <RecordViewSheetDetailRow
              label={t("employeeTitles.active")}
              value={t(title.active ? "employeeTitles.active" : "employeeTitles.inactive")}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("employeeTitles.view.sections.audit")} icon={Info}>
            <RecordViewSheetDetailRow label={t("employeeTitles.view.recordId")} value={title.id} />
            <RecordViewSheetDetailRow
              label={t("common.apiColumns.createdAt")}
              value={title.createdAt ? formatAuditDateTime(title.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.apiColumns.updatedAt")}
              value={title.updatedAt ? formatAuditDateTime(title.updatedAt) : dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("employeeTitles.view.edit")}
          onEdit={canEdit ? () => onEdit(title) : undefined}
          onDelete={canDelete ? () => onDelete(title) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
