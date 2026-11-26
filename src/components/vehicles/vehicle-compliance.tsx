"use client";

import { AlertTriangle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import {
  describeVehicleComplianceTiming,
  getVehicleComplianceDate,
  getVehicleComplianceDue,
  listVehicleComplianceDue,
  type VehicleComplianceDue,
  type VehicleComplianceKind,
} from "@/lib/vehicles/compliance-due";
import { formatVehicleDate } from "@/lib/vehicles/display";
import type { Vehicle } from "@/lib/vehicles/types";
import { cn } from "@/lib/utils";

type DateCellProps = {
  vehicle: Vehicle;
  kind: VehicleComplianceKind;
  today: string;
};

function formatComplianceAlertLine(
  due: VehicleComplianceDue,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const timing = describeVehicleComplianceTiming(due.daysRemaining);
  return t("vehicles.compliance.cautionTooltip", {
    kind: t(`vehicles.compliance.kind.${due.kind}`),
    timing: t(timing.key, timing.params),
    date: formatVehicleDate(due.date),
  });
}

export function VehicleComplianceDateCell({ vehicle, kind, today }: DateCellProps) {
  const label = formatVehicleDate(getVehicleComplianceDate(vehicle, kind));
  const due = getVehicleComplianceDue(vehicle, kind, today);

  return (
    <span className={cn(due && "font-medium text-destructive")}>
      {label}
    </span>
  );
}

type NameCellProps = {
  vehicle: Vehicle;
  today: string;
};

/** Name plus a single caution control that lists every due inspection/registration. */
export function VehicleComplianceNameCell({ vehicle, today }: NameCellProps) {
  const { t } = useTranslation();
  const dues = listVehicleComplianceDue(vehicle, today);
  if (dues.length === 0) return <>{vehicle.name}</>;

  const lines = dues.map((due) => formatComplianceAlertLine(due, t));
  const tooltipLabel = lines.join(" · ");

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{vehicle.name}</span>
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
        <TooltipContent className="max-w-xs">
          <ul className="space-y-1 text-left">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
