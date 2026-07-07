"use client";

import { Container as ContainerIcon, Ship } from "lucide-react";

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
          meta={
            <>
              {container.containerNumber ? (
                <Badge variant="outline" className="font-mono">
                  {container.containerNumber}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-mono">
                {container.booking}
              </Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={ContainerIcon} title={t("containers.form.sections.container")}>
            <RecordViewSheetDetailRow label={t("containers.form.fields.sealNumber")} value={container.sealNumber || dash} />
            <RecordViewSheetDetailRow label={t("containers.view.containerId")} value={formatContainerId(container.id)} />
            <RecordViewSheetDetailRow
              label={t("containers.view.barcodeSequence")}
              value={container.barcodeSequence > 0 ? container.barcodeSequence : dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={Ship} title={t("containers.form.sections.logistics")}>
            <RecordViewSheetDetailRow label={t("containers.form.fields.broker")} value={container.broker || dash} />
            <RecordViewSheetDetailRow label={t("containers.form.fields.company")} value={container.company || dash} />
            <RecordViewSheetDetailRow label={t("containers.form.fields.cost")} value={formatOptionalContainerCost(container.cost)} />
            <RecordViewSheetDetailRow
              label={t("containers.form.fields.departureDate")}
              value={formatContainerDate(container.departureDate)}
            />
            <RecordViewSheetDetailRow
              label={t("containers.form.fields.arrivalDate")}
              value={formatContainerDate(container.arrivalDate)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("containers.view.sections.audit")}>
            <RecordViewSheetDetailRow label={t("common.audit.dateCreated")} value={formatAuditDate(container.createdAt)} />
            <RecordViewSheetDetailRow label={t("common.audit.dateModified")} value={formatAuditDate(container.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("containers.actions.edit")}
          deleteLabel={t("common.actions.delete")}
          onEdit={() => onEdit(container)}
          onDelete={() => onDelete(container)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
