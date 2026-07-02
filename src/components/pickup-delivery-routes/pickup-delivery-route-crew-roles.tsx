"use client";

import { useTranslation } from "@/lib/i18n";
import type { RouteEmployeeRef } from "@/lib/route-manager/types";
import { cn } from "@/lib/utils";

type ActiveRouteCrewRolesProps = {
  employees: RouteEmployeeRef[];
  driver: RouteEmployeeRef | null;
  appraiser: RouteEmployeeRef | null;
  loading?: boolean;
  onDriverChange: (employee: RouteEmployeeRef | null) => void;
  onAppraiserChange: (employee: RouteEmployeeRef | null) => void;
};

export function ActiveRouteCrewRoles({
  employees,
  driver,
  appraiser,
  loading = false,
  onDriverChange,
  onAppraiserChange,
}: ActiveRouteCrewRolesProps) {
  const { t } = useTranslation();

  function toggleDriver(employee: RouteEmployeeRef, checked: boolean) {
    onDriverChange(checked ? employee : driver?.id === employee.id ? null : driver);
  }

  function toggleAppraiser(employee: RouteEmployeeRef, checked: boolean) {
    onAppraiserChange(checked ? employee : appraiser?.id === employee.id ? null : appraiser);
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("routes.activeRoute.loadingRoute")}</p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("routes.activeRoute.crewRolesEmpty")}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("routes.routeDetails.employees")}</span>
            <span className="text-center">{t("routes.activeRoute.driver")}</span>
            <span className="text-center">{t("routes.activeRoute.appraiser")}</span>
          </div>
          <ul className="divide-y divide-border">
            {employees.map((employee) => {
              const isDriver = driver?.id === employee.id;
              const isAppraiser = appraiser?.id === employee.id;

              return (
                <li
                  key={employee.id}
                  className={cn(
                    "grid grid-cols-[1fr_4.5rem_5.5rem] items-center gap-2 px-3 py-2.5 text-sm",
                    (isDriver || isAppraiser) && "bg-primary/5",
                  )}
                >
                  <span className="min-w-0 font-medium">{employee.name}</span>
                  <label className="flex cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={isDriver}
                      onChange={(event) => toggleDriver(employee, event.target.checked)}
                      aria-label={t("routes.activeRoute.driverFor", { name: employee.name })}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={isAppraiser}
                      onChange={(event) => toggleAppraiser(employee, event.target.checked)}
                      aria-label={t("routes.activeRoute.appraiserFor", { name: employee.name })}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
