"use client";

import { AlertTriangle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import {
  describeVehicleComplianceTiming,
  getVehicleComplianceDate,
  getVehicleComplianceDue,
  type VehicleComplianceKind,
} from "@/lib/vehicles/compliance-due";
import { formatVehicleDate } from "@/lib/vehicles/display";
import type { Vehicle } from "@/lib/vehicles/types";

type DateCellProps = {
  vehicle: Vehicle;
  kind: VehicleComplianceKind;
  today: string;
};

export function VehicleComplianceDateCell({ vehicle, kind, today }: DateCellProps) {
  const { t } = useTranslation();
  const label = formatVehicleDate(getVehicleComplianceDate(vehicle, kind));
  const due = getVehicleComplianceDue(vehicle, kind, today);
  if (!due) return <>{label}</>;

  const timing = describeVehicleComplianceTiming(due.daysRemaining);
  const tooltipLabel = t("vehicles.compliance.cautionTooltip", {
    kind: t(`vehicles.compliance.kind.${due.kind}`),
    timing: t(timing.key, timing.params),
    date: formatVehicleDate(due.date),
  });

  return (
    <span className="inline-flex items-center gap-1 font-medium text-destructive">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={tooltipLabel}
            onClick={(event) => event.stopPropagation()}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    </span>
  );
}
