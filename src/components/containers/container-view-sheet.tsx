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
  formatContainerDate,
  formatContainerId,
  formatOptionalContainerCost,
} from "@/lib/containers/display";
import type { Container } from "@/lib/containers/types";
import { useTranslation } from "@/lib/i18n";

type ContainerViewSheetProps = {
  container: Container | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (container: Container) => void;
  onDelete: (container: Container) => void;
};

export function ContainerViewSheet({
  container,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ContainerViewSheetProps) {
  const { t } = useTranslation();

  if (!container) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={container.name}
          description={<span className="font-mono text-xs">{container.containerNumber}</span>}
          meta={
            <>
              <Badge variant="outline">{container.company || t("common.empty.noCarrier")}</Badge>
              <Badge variant="secondary">{formatOptionalContainerCost(container.cost)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("containers.view.shipping")}>
            <RecordViewSheetDetailRow label={t("containers.view.containerId")} value={formatContainerId(container.id)} />
            <RecordViewSheetDetailRow label={t("containers.columns.container")} value={container.name} />
            <RecordViewSheetDetailRow label={t("containers.columns.containerNumber")} value={container.containerNumber || dash} />
            <RecordViewSheetDetailRow label={t("containers.columns.booking")} value={container.booking} />
            <RecordViewSheetDetailRow label={t("containers.columns.sealNumber")} value={container.sealNumber || dash} />
            <RecordViewSheetDetailRow label={t("containers.columns.broker")} value={container.broker || dash} />
            <RecordViewSheetDetailRow label={t("containers.columns.company")} value={container.company || dash} />
            <RecordViewSheetDetailRow label={t("containers.columns.cost")} value={formatOptionalContainerCost(container.cost)} />
            <RecordViewSheetDetailRow
              label={t("containers.view.barcodeSequence")}
              value={container.barcodeSequence > 0 ? container.barcodeSequence : dash}
            />
            <RecordViewSheetDetailRow label={t("containers.view.departureDate")} value={formatContainerDate(container.departureDate)} />
            <RecordViewSheetDetailRow label={t("containers.view.arrivalDate")} value={formatContainerDate(container.arrivalDate)} />
            <RecordViewSheetDetailRow label={t("common.audit.dateCreated")} value={formatAuditDate(container.createdAt)} />
            <RecordViewSheetDetailRow label={t("common.audit.dateModified")} value={formatAuditDate(container.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("containers.actions.edit")}
          onEdit={() => onEdit(container)}
          onDelete={() => onDelete(container)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
