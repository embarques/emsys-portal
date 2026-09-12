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
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { getCheckStatusBadgeClass } from "@/lib/accounting/checks/display";
import { checkStatusI18nKey, type Check } from "@/lib/accounting/checks/types";
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
          title={check.checkNumber || dash}
          meta={
            <Badge variant="outline" className={cn("font-medium", getCheckStatusBadgeClass(check.status))}>
              {t(`accounting.checks.status.${checkStatusI18nKey(check.status)}`)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={Banknote} title={t("accounting.checks.form.sections.details")}>
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.invoice")}
              value={check.invoice.number || dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.checkNumber")}
              value={check.checkNumber || dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.paymentAmount")}
              value={formatAccountingMoney(check.paymentAmount)}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.datePosted")}
              value={check.datePosted ? formatAuditDate(check.datePosted) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.referenceNumber")}
              value={check.refNumber || dash}
            />
          </RecordViewSheetSection>

          {check.status === "CLEARED" ? (
            <RecordViewSheetSection icon={Banknote} title={t("accounting.checks.form.sections.clearance")}>
              <RecordViewSheetDetailRow
                label={t("accounting.checks.form.fields.clearedAt")}
                value={check.clearedAt ? formatAuditDate(check.clearedAt) : dash}
              />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("accounting.checks.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("common.audit.dateCreated")}
              value={check.createdAt ? formatAuditDateTime(check.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("accounting.checks.form.fields.createdBy")}
              value={check.createdBy || dash}
            />
            {check.updatedAt ? (
              <RecordViewSheetDetailRow
                label={t("common.audit.dateModified")}
                value={formatAuditDateTime(check.updatedAt)}
              />
            ) : null}
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
