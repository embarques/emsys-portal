"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  describeVehicleComplianceTiming,
  getVehicleComplianceDate,
  getVehicleComplianceDue,
  type VehicleComplianceDue,
  type VehicleComplianceKind,
} from "@/lib/vehicles/compliance-due";
import { formatVehicleDate } from "@/lib/vehicles/display";
import { VEHICLE_FLEET_SNAPSHOT_LIMIT } from "@/lib/vehicles/hooks/use-vehicles";
import type { Vehicle } from "@/lib/vehicles/types";

const BANNER_VISIBLE_LIMIT = 6;

type BannerProps = {
  items: VehicleComplianceDue[];
  isPartial?: boolean;
  onOpenVehicle: (vehicle: Vehicle) => void;
  className?: string;
};

export function VehicleComplianceBanner({ items, isPartial = false, onOpenVehicle, className }: BannerProps) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  const visible = items.slice(0, BANNER_VISIBLE_LIMIT);
  const hidden = items.length - visible.length;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <p className="font-medium leading-snug">
            {t(`vehicles.compliance.bannerTitle_${items.length === 1 ? "one" : "other"}`, { count: items.length })}
          </p>
          <p className="leading-snug">{t("vehicles.compliance.bannerDescription")}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {visible.map((entry) => {
            const timing = describeVehicleComplianceTiming(entry.daysRemaining);
            return (
              <li key={`${entry.vehicle.id}:${entry.kind}`}>
                <button
                  type="button"
                  onClick={() => onOpenVehicle(entry.vehicle)}
                  className="rounded-md border border-destructive/30 bg-background/60 px-2.5 py-1 text-left text-xs font-medium transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {t("vehicles.compliance.entry", {
                    name: entry.vehicle.name || t("vehicles.dialogs.unnamed"),
                    kind: t(`vehicles.compliance.kind.${entry.kind}`),
                    timing: t(timing.key, timing.params),
                  })}
                  <span className="ml-1 font-normal opacity-80">({formatVehicleDate(entry.date)})</span>
                </button>
              </li>
            );
          })}
          {hidden > 0 ? (
            <li className="self-center text-xs">{t("vehicles.compliance.more", { count: hidden })}</li>
          ) : null}
        </ul>
        {isPartial ? (
          <p className="text-xs opacity-80">
            {t("vehicles.compliance.partial", { limit: VEHICLE_FLEET_SNAPSHOT_LIMIT })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
  const timingLabel = t(timing.key, timing.params);
  return (
    <span className="inline-flex items-center gap-1 font-medium text-destructive" title={timingLabel}>
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      {label}
      <span className="sr-only">{timingLabel}</span>
    </span>
  );
}
