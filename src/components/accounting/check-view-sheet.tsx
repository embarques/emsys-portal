"use client";

import { Banknote } from "lucide-react";

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
import { formatAuditDateTime } from "@/lib/audit/display";
import { getCheckStatusBadgeClass } from "@/lib/accounting/checks/display";
import type { Check } from "@/lib/accounting/checks/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CheckViewSheetProps = {
  check: Check | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (check: Check) => void;
  onDelete: (check: Check) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function CheckViewSheet({
  check,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: CheckViewSheetProps) {
  const { t } = useTranslation();

  if (!check) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={check.receiptNumber}
          meta={
            <Badge variant="outline" className={cn("font-medium", getCheckStatusBadgeClass(check.status))}>
              {t(`accounting.checks.status.${check.status}`)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={Banknote} title={t("accounting.checks.form.sections.details")}>
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.invoiceNumber")}
              value={check.invoiceNumber}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.receiptNumber")}
              value={check.receiptNumber}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.referenceNumber")}
              value={check.referenceNumber || dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.createdBy")}
              value={check.createdBy}
            />
          </RecordViewSheetSection>

          {check.status === "cleared" ? (
            <RecordViewSheetSection icon={Banknote} title={t("accounting.checks.form.sections.deposit")}>
              <RecordViewSheetDetailRow
                label={t("accounting.checks.form.fields.depositedAt")}
                value={check.depositedAt ? formatAuditDateTime(check.depositedAt) : dash}
              />
              <RecordViewSheetDetailRow
                label={t("accounting.checks.form.fields.depositedOn")}
                value={check.depositedOn ?? dash}
              />
              <RecordViewSheetDetailRow
                label={t("accounting.checks.form.fields.depositedBy")}
                value={check.depositedBy ?? dash}
              />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("accounting.checks.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("common.audit.dateCreated")}
              value={formatAuditDateTime(check.createdAt)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("accounting.checks.actions.edit")}
          deleteLabel={t("common.actions.delete")}
          onEdit={canEdit ? () => onEdit(check) : undefined}
          onDelete={canDelete ? () => onDelete(check) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
