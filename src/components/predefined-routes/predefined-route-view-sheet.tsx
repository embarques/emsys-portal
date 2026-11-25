"use client";

import { MapPinned } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { isRouteZipCode } from "@/lib/orders/predefined-route-filter";
import type { PredefinedRoute } from "@/lib/predefined-routes/types";
import { parseRouteCities } from "@/lib/predefined-routes/utils/route-cities";

type PredefinedRouteViewSheetProps = {
  route: PredefinedRoute | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (route: PredefinedRoute) => void;
  onDelete: (route: PredefinedRoute) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
};

function CoverageBadges({ entries, empty }: { entries: string[]; empty: string }) {
  if (!entries.length) return <>{empty}</>;
  return (
    <div className="flex max-w-full flex-wrap justify-end gap-1">
      {entries.map((entry) => (
        <Badge key={entry.toLowerCase()} variant="secondary" data-uniform-width="off">
          {entry}
        </Badge>
      ))}
    </div>
  );
}

export function PredefinedRouteViewSheet({
  route,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  editDisabled = false,
  deleteDisabled = false,
}: PredefinedRouteViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  if (!route) return null;

  const entries = parseRouteCities(route.content);
  const cities = entries.filter((entry) => !isRouteZipCode(entry));
  const zipcodes = entries.filter(isRouteZipCode);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={MapPinned}
          eyebrow={t("predefinedRoutes.entity")}
          title={route.name.trim() || dash}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("predefinedRoutes.view.sections.details")} icon={MapPinned}>
            <RecordViewSheetDetailRow label={t("predefinedRoutes.view.recordId")} value={route.id} />
            <RecordViewSheetDetailRow label={t("predefinedRoutes.fields.name")} value={route.name || dash} />
            <RecordViewSheetDetailRow
              label={t("predefinedRoutes.fields.cities")}
              value={<CoverageBadges entries={cities} empty={dash} />}
            />
            <RecordViewSheetDetailRow
              label={t("predefinedRoutes.fields.zipcodes")}
              value={<CoverageBadges entries={zipcodes} empty={dash} />}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("predefinedRoutes.view.edit")}
          onEdit={canEdit ? () => onEdit(route) : undefined}
          onDelete={canDelete ? () => onDelete(route) : undefined}
          editDisabled={editDisabled}
          deleteDisabled={deleteDisabled}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
