"use client";

import { Banknote, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import type { ClearablePaymentMethodConfig } from "@/lib/accounting/clearable-payments/configs";
import { getClearablePaymentStatusBadgeClass } from "@/lib/accounting/clearable-payments/display";
import {
  clearablePaymentStatusI18nKey,
  type ClearablePayment,
} from "@/lib/accounting/clearable-payments/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ClearablePaymentViewSheetProps = {
  config: ClearablePaymentMethodConfig;
  payment: ClearablePayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkCleared?: (payment: ClearablePayment) => void;
  canMarkCleared?: boolean;
  isMarkingCleared?: boolean;
};

export function ClearablePaymentViewSheet({
  config,
  payment,
  open,
  onOpenChange,
  onMarkCleared,
  canMarkCleared = false,
  isMarkingCleared = false,
}: ClearablePaymentViewSheetProps) {
  const { t } = useTranslation();
  const i18n = `accounting.${config.i18nKey}`;

  if (!payment) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={payment.paymentReference || dash}
          meta={
            <Badge
              variant="outline"
              className={cn("font-medium", getClearablePaymentStatusBadgeClass(payment.status))}
            >
              {t(`${i18n}.status.${clearablePaymentStatusI18nKey(payment.status)}`)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={Banknote} title={t(`${i18n}.form.sections.details`)}>
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.invoice`)}
              value={payment.invoice.number || dash}
            />
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.paymentReference`)}
              value={payment.paymentReference || dash}
            />
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.paymentAmount`)}
              value={formatAccountingMoney(payment.paymentAmount)}
            />
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.datePosted`)}
              value={payment.datePosted ? formatAuditDate(payment.datePosted) : dash}
            />
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.referenceNumber`)}
              value={payment.refNumber || dash}
            />
          </RecordViewSheetSection>

          {payment.status === "CLEARED" ? (
            <RecordViewSheetSection icon={Banknote} title={t(`${i18n}.form.sections.clearance`)}>
              <RecordViewSheetDetailRow
                label={t(`${i18n}.form.fields.clearedAt`)}
                value={payment.clearedAt ? formatAuditDate(payment.clearedAt) : dash}
              />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t(`${i18n}.view.sections.audit`)}>
            <RecordViewSheetDetailRow
              label={t("common.audit.dateCreated")}
              value={payment.createdAt ? formatAuditDateTime(payment.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t(`${i18n}.form.fields.createdBy`)}
              value={payment.createdBy || dash}
            />
            {payment.updatedAt ? (
              <RecordViewSheetDetailRow
                label={t("common.audit.dateModified")}
                value={formatAuditDateTime(payment.updatedAt)}
              />
            ) : null}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        {canMarkCleared && payment.status === "OUTSTANDING" && onMarkCleared ? (
          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            <Button
              className="w-full"
              disabled={isMarkingCleared}
              onClick={() => onMarkCleared(payment)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t(`${i18n}.actions.markCleared`)}
            </Button>
          </div>
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
