"use client";

import { useMemo } from "react";
import { Route, UserRound } from "lucide-react";

import { EmployeePicker } from "@/components/employees/employee-picker";
import { TableFilterSelect } from "@/components/app-shell/table-filter-select";
import { useTranslation } from "@/lib/i18n";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { RouteType } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

export type RouteWorkScopeMode = "supervisor" | "dailyRoute";

export type RouteWorkScopeState = {
  mode: RouteWorkScopeMode | "";
  value: string;
};

type RouteWorkScopeFilterProps = {
  routeType: RouteType;
  value: RouteWorkScopeState;
  onChange: (next: RouteWorkScopeState) => void;
};

/**
 * Dual-mode route work scope: assigned supervisor (employee) or daily route,
 * below advanced filters. "Supervisor" is the responsible-party label; the
 * picker always lists employees.
 */
export function RouteWorkScopeFilter({ routeType, value, onChange }: RouteWorkScopeFilterProps) {
  const { t } = useTranslation();
  const routesQuery = useActiveRoutePicker(routeType, 200, { enabled: value.mode === "dailyRoute" });
  const routeOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(routesQuery.data?.items ?? [], t),
    [routesQuery.data?.items, t],
  );

  function setMode(mode: string) {
    const nextMode = mode === "supervisor" || mode === "dailyRoute" ? mode : "";
    onChange({ mode: nextMode, value: "" });
  }

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-5 pb-1">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("orders.routeWorkScope.label")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                mode: "supervisor" as const,
                label: t("orders.routeWorkScope.supervisor"),
                icon: UserRound,
              },
              {
                mode: "dailyRoute" as const,
                label: t("orders.routeWorkScope.dailyRoute"),
                icon: Route,
              },
            ] as const
          ).map((option) => {
            const selected = value.mode === option.mode;
            const Icon = option.icon;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                onClick={() => setMode(selected ? "" : option.mode)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("orders.routeWorkScope.hint")}</p>
      </div>

      {value.mode === "supervisor" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="route-work-scope-supervisor">
            {t("orders.routeWorkScope.selectSupervisor")}
          </label>
          <EmployeePicker
            id="route-work-scope-supervisor"
            value={value.value}
            onChange={(employeeId) => onChange({ mode: "supervisor", value: employeeId })}
            placeholder={t("orders.routeWorkScope.supervisorPlaceholder")}
            searchPlaceholder={t("orders.routeWorkScope.searchEmployees")}
            emptyMessage={t("orders.routeWorkScope.noEmployeesFound")}
            contentClassName="z-[110]"
          />
        </div>
      ) : null}

      {value.mode === "dailyRoute" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="route-work-scope-daily-route">
            {t("orders.routeWorkScope.selectDailyRoute")}
          </label>
          <TableFilterSelect
            aria-label={t("orders.routeWorkScope.selectDailyRoute")}
            className="w-full"
            value={value.value}
            options={routeOptions}
            loading={routesQuery.isFetching}
            placeholder={t("orders.routeWorkScope.dailyRoutePlaceholder")}
            onChange={(routeId) => onChange({ mode: "dailyRoute", value: routeId })}
          />
          {routesQuery.isError ? (
            <p role="alert" className="text-xs text-destructive">
              {t("orders.routeWorkScope.dailyRouteLoadError")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
