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
  if (!branch) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={branch.name}
          description={branch.code || `Branch ${formatBranchId(branch.id)}`}
          meta={
            <>
              {branch.type ? (
                <Badge className={getBranchTypeBadgeClass(branch.type)}>{branch.type}</Badge>
              ) : null}
              {branch.settings.labelPrefix ? (
                <Badge variant="outline">Prefix: {branch.settings.labelPrefix}</Badge>
              ) : null}
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label="ID" value={formatBranchId(branch.id)} />
            <RecordViewSheetDetailRow label="Name" value={branch.name} />
            <RecordViewSheetDetailRow label="Code" value={branch.code || "—"} />
            <RecordViewSheetDetailRow label="Type" value={branch.type || "—"} />
            <RecordViewSheetDetailRow label="Logo" value={branch.logo || "—"} />
            <RecordViewSheetDetailRow label="Disclaimer" value={branch.disclaimer || "—"} />
            <RecordViewSheetDetailRow
              label="Created"
              value={branch.created ? formatAuditDate(branch.created) : "—"}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="Phone 1" value={branch.phone1 || "—"} />
            <RecordViewSheetDetailRow label="Phone 2" value={branch.phone2 || "—"} />
            <RecordViewSheetDetailRow label="Phones" value={formatBranchPhones(branch)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Address">
            <RecordViewSheetDetailRow label="Address 1" value={branch.address.address1 || "—"} />
            <RecordViewSheetDetailRow label="Address 2" value={branch.address.address2 || "—"} />
            <RecordViewSheetDetailRow label="Apartment" value={branch.address.apartment || "—"} />
            <RecordViewSheetDetailRow label="City" value={branch.address.city || "—"} />
            <RecordViewSheetDetailRow label="State" value={branch.address.state || "—"} />
            <RecordViewSheetDetailRow label="Zipcode" value={branch.address.zipcode || "—"} />
            <RecordViewSheetDetailRow label="Country" value={branch.address.country || "—"} />
            <RecordViewSheetDetailRow label="Full address" value={formatBranchAddress(branch)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Settings">
            <RecordViewSheetDetailRow label="Label prefix" value={branch.settings.labelPrefix || "—"} />
            <RecordViewSheetDetailRow label="Default label status" value={String(branch.settings.defaultLabelStatus)} />
            <RecordViewSheetDetailRow label="Round decimal places" value={String(branch.settings.roundDecimalPlaces)} />
            <RecordViewSheetDetailRow
              label="Invoice via income statement"
              value={branch.settings.invoiceCreatedThruIncomeStatement ? "Yes" : "No"}
            />
            <RecordViewSheetDetailRow label="Print label count" value={branch.settings.printLabelCount ? "Yes" : "No"} />
            <RecordViewSheetDetailRow label="S3 profile" value={branch.settings.s3Profile || "—"} />
            <RecordViewSheetDetailRow label="S3 bucket" value={branch.settings.s3BucketName || "—"} />
            <RecordViewSheetDetailRow label="S3 folder" value={branch.settings.s3BucketFolder || "—"} />
            <RecordViewSheetDetailRow
              label="S3 link expiry (min)"
              value={String(branch.settings.s3ShareLinkExpireMinutes)}
            />
            <RecordViewSheetDetailRow label="Image resample by" value={String(branch.settings.imageResampleBy)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit branch"
          onEdit={() => onEdit(branch)}
          onDelete={() => onDelete(branch)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
