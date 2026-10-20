"use client";

import { AddressActionRow } from "@/components/addresses/address-action-row";
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
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { formatRecordPhoneTypeLabel, getOrderedRecordPhones } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import {
  formatBranchId,
  getBranchTypeBadgeClass,
  hasBranchAddress,
  toBranchActionAddress,
} from "@/lib/branches/display";
import type { Branch } from "@/lib/branches/types";

type BranchViewSheetProps = {
  branch: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function BranchViewSheet({
  branch,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: BranchViewSheetProps) {
  const { t } = useTranslation();

  if (!branch) return null;

  const dash = t("common.empty.dash");
  const booleanLabel = (value: boolean) =>
    t(value ? "branches.enums.boolean.true" : "branches.enums.boolean.false");
  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={branch.name.trim() || dash}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {branch.code.trim() ||
                  t("branches.view.branchFallback", { id: formatBranchId(branch.id) })}
              </span>
              {branch.type ? (
                <Badge variant="outline" className={getBranchTypeBadgeClass(branch.type)}>
                  {branch.type}
                </Badge>
              ) : null}
              {branch.settings.labelPrefix ? (
                <Badge variant="outline">
                  {t("branches.view.prefixLabel", { prefix: branch.settings.labelPrefix })}
                </Badge>
              ) : null}
            </div>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("branches.view.sections.branch")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.branchId")}
              value={formatBranchId(branch.id)}
            />
            <RecordViewSheetDetailRow label={t("branches.view.fields.type")} value={branch.type || dash} />
            <RecordViewSheetDetailRow label={t("branches.view.fields.logo")} value={branch.logo || dash} />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.disclaimer")}
              value={branch.disclaimer || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.createdAt")}
              value={branch.createdAt ? formatAuditDateTime(branch.createdAt) : dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.contact")}>
            {getOrderedRecordPhones(branch.phones).length === 0 ? (
              <RecordViewSheetDetailRow label={t("branches.view.fields.phones")} value={dash} />
            ) : (
              getOrderedRecordPhones(branch.phones).map((phone, index) => (
                <PhoneActionRow
                  key={`phone-${index}`}
                  label={
                    phone.isPrimary
                      ? t("branches.view.phonePrimary", {
                          type: formatRecordPhoneTypeLabel(phone.type),
                        })
                      : formatRecordPhoneTypeLabel(phone.type)
                  }
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                />
              ))
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.address")}>
            {hasBranchAddress(branch) ? (
              <AddressActionRow
                label={t("branches.view.fields.fullAddress")}
                address={toBranchActionAddress(branch)}
              />
            ) : (
              <RecordViewSheetDetailRow label={t("branches.view.fields.fullAddress")} value={dash} />
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.settings")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.defaultLabelStatus")}
              value={String(branch.settings.defaultLabelStatus)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.roundDecimalPlaces")}
              value={String(branch.settings.roundDecimalPlaces)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.invoiceViaIncomeStatement")}
              value={booleanLabel(branch.settings.invoiceCreatedThruIncomeStatement)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.printLabelCount")}
              value={booleanLabel(branch.settings.printLabelCount)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.s3Profile")}
              value={branch.settings.s3Profile || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.s3Bucket")}
              value={branch.settings.s3BucketName || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.s3Folder")}
              value={branch.settings.s3BucketFolder || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.s3LinkExpiry")}
              value={String(branch.settings.s3ShareLinkExpireMinutes)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.imageResampleBy")}
              value={String(branch.settings.imageResampleBy)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("branches.view.edit")}
          onEdit={canEdit ? () => onEdit(branch) : undefined}
          onDelete={canDelete ? () => onDelete(branch) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
