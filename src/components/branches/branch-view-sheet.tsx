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
import { useTranslation } from "@/lib/i18n";
import {
  formatBranchAddress,
  formatBranchId,
  formatBranchPhones,
  getBranchTypeBadgeClass,
} from "@/lib/branches/display";
import type { Branch } from "@/lib/branches/types";

type BranchViewSheetProps = {
  branch: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
};

export function BranchViewSheet({ branch, open, onOpenChange, onEdit, onDelete }: BranchViewSheetProps) {
  const { t } = useTranslation();

  if (!branch) return null;

  const dash = t("common.empty.dash");
  const booleanLabel = (value: boolean) =>
    t(value ? "branches.enums.boolean.true" : "branches.enums.boolean.false");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={branch.name}
          description={
            branch.code || t("branches.view.branchFallback", { id: formatBranchId(branch.id) })
          }
          meta={
            <>
              {branch.type ? (
                <Badge className={getBranchTypeBadgeClass(branch.type)}>{branch.type}</Badge>
              ) : null}
              {branch.settings.labelPrefix ? (
                <Badge variant="outline">
                  {t("branches.view.prefixLabel", { prefix: branch.settings.labelPrefix })}
                </Badge>
              ) : null}
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("branches.view.sections.branch")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.branchId")}
              value={formatBranchId(branch.id)}
            />
            <RecordViewSheetDetailRow label={t("branches.view.fields.name")} value={branch.name} />
            <RecordViewSheetDetailRow label={t("branches.view.fields.code")} value={branch.code || dash} />
            <RecordViewSheetDetailRow label={t("branches.view.fields.type")} value={branch.type || dash} />
            <RecordViewSheetDetailRow label={t("branches.view.fields.logo")} value={branch.logo || dash} />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.disclaimer")}
              value={branch.disclaimer || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.created")}
              value={branch.created ? formatAuditDate(branch.created) : dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.contact")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.phone1")}
              value={formatPhoneDisplayOrDash(branch.phone1)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.phone2")}
              value={formatPhoneDisplayOrDash(branch.phone2)}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.phones")}
              value={formatBranchPhones(branch)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.address")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.address1")}
              value={branch.address.address1 || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.address2")}
              value={branch.address.address2 || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.apartment")}
              value={branch.address.apartment || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.city")}
              value={branch.address.city || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.state")}
              value={branch.address.state || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.zipcode")}
              value={branch.address.zipcode || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.country")}
              value={branch.address.country || dash}
            />
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.fullAddress")}
              value={formatBranchAddress(branch)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("branches.view.sections.settings")}>
            <RecordViewSheetDetailRow
              label={t("branches.view.fields.labelPrefix")}
              value={branch.settings.labelPrefix || dash}
            />
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
          onEdit={() => onEdit(branch)}
          onDelete={() => onDelete(branch)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
