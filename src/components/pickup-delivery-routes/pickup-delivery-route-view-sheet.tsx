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
import { PickupRouteOrdersSection } from "@/components/pickup-delivery-routes/pickup-route-orders-section";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import {
  formatActiveRouteAppraiserName,
  formatActiveRouteContainerLabel,
  formatActiveRouteDriverNames,
  formatActiveRouteHelperNames,
  formatActiveRouteRowLabel,
  formatActiveRouteTypeLabel,
} from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { formatRouteDate, truncateObjectId } from "@/lib/route-manager/display";

type ActiveRouteViewSheetProps = {
  record: ActiveRoute | null;
  variant: ActiveRoutesDirectoryVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (record: ActiveRoute) => void;
  onDelete: (record: ActiveRoute) => void;
};

function formatScheduleLabel(
  record: ActiveRoute,
  t: (key: string) => string,
  dash: string,
): string {
  if (record.date) {
    return formatRouteDate(record.date);
  }

  if (record.dayOfWeek.length > 0) {
    return record.dayOfWeek.map((day) => t(`routes.activeRoute.days.${day}`)).join(", ");
  }

  return dash;
}

export function ActiveRouteViewSheet({
  record,
  variant,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ActiveRouteViewSheetProps) {
  const { t } = useTranslation();
  const copyPrefix = variant.copyPrefix;
  const dash = t("common.empty.dash");

  if (!record) return null;

  const title = formatActiveRouteRowLabel(record, dash, t);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={title}
          description={
            record.route.name ? (
              <span className="text-sm text-muted-foreground">{record.route.name}</span>
            ) : undefined
          }
          meta={
            <Badge variant={record.active ? "default" : "secondary"}>
              {record.active ? t("routes.activeRoute.active") : t("routes.activeRoute.inactive")}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("routes.activeRouteForm.sections.schedule")}>
            <RecordViewSheetDetailRow
              label={t("routes.columns.date")}
              value={formatScheduleLabel(record, t, dash)}
            />
            {variant.showRouteTypeField ? (
              <RecordViewSheetDetailRow
                label={t("routes.columns.routeType")}
                value={formatActiveRouteTypeLabel(record.routeType, t)}
              />
            ) : null}
            {record.name ? (
              <RecordViewSheetDetailRow label={t("routes.columns.name")} value={record.name} />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t(`routes.${copyPrefix}.view.sections.assignment`)}>
            <RecordViewSheetDetailRow
              label={t("routes.viewSheet.recordId")}
              value={truncateObjectId(record.id)}
            />
            {variant.showContainerField ? (
              <RecordViewSheetDetailRow
                label={t("routes.columns.container")}
                value={formatActiveRouteContainerLabel(record, dash)}
              />
            ) : null}
            <RecordViewSheetDetailRow
              label={t("routes.columns.branch")}
              value={record.branch?.code || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.route")}
              value={record.route.name || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("routes.viewSheet.sections.employees")}>
            <RecordViewSheetDetailRow
              label={t("routes.columns.driver")}
              value={formatActiveRouteDriverNames(record) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.appraiser")}
              value={formatActiveRouteAppraiserName(record) || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.helper")}
              value={formatActiveRouteHelperNames(record) || dash}
            />
          </RecordViewSheetSection>

          {record.routeType === "pickup" ? (
            <RecordViewSheetSection title={t("routes.pickupRoutes.view.sections.orders")}>
              <PickupRouteOrdersSection routeId={record.id} enabled={open} />
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("routes.viewSheet.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("routes.columns.createdAt")}
              value={record.createdAt ? formatAuditDateTime(record.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.createdBy")}
              value={record.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.updatedAt")}
              value={record.updatedAt ? formatAuditDateTime(record.updatedAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("routes.columns.updatedBy")}
              value={record.updatedBy || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t(`routes.${copyPrefix}.view.editLabel`)}
          onEdit={() => onEdit(record)}
          onDelete={() => onDelete(record)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
