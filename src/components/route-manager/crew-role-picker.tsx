"use client";

import { Car, ClipboardList, Hand, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  employeeHasRole,
  type RouteCrewRole,
  type RouteEmployeeRef,
} from "@/lib/route-manager/types";
import { cn } from "@/lib/utils";

type CrewRolePickerProps = {
  employees: RouteEmployeeRef[];
  onRoleChange: (employeeId: number, role: RouteCrewRole) => void;
  onRemove?: (employeeId: number) => void;
  /** Roles to offer, in order. Defaults to driver/appraiser/helper. */
  roles?: RouteCrewRole[];
  /** When true, driver and appraiser can both be active on the same employee. */
  toggleLeadRoles?: boolean;
  loading?: boolean;
  emptyMessage?: string;
};

const ROLE_META: Record<
  RouteCrewRole,
  { icon: LucideIcon; labelKey: string; forKey: string; accentClass: string }
> = {
  driver: {
    icon: Car,
    labelKey: "routes.activeRoute.driver",
    forKey: "routes.activeRoute.driverFor",
    accentClass: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  },
  appraiser: {
    icon: ClipboardList,
    labelKey: "routes.activeRoute.appraiser",
    forKey: "routes.activeRoute.appraiserFor",
    accentClass: "border-blue-600/40 bg-blue-600/10 text-blue-800 dark:text-blue-300",
  },
  helper: {
    icon: Hand,
    labelKey: "routes.activeRoute.helper",
    forKey: "routes.activeRoute.helperFor",
    accentClass: "border-amber-600/40 bg-amber-600/10 text-amber-800 dark:text-amber-300",
  },
};

const ROLE_ORDER: RouteCrewRole[] = ["driver", "appraiser", "helper"];

export function CrewRolePicker({
  employees,
  onRoleChange,
  onRemove,
  roles,
  toggleLeadRoles = false,
  loading = false,
  emptyMessage,
}: CrewRolePickerProps) {
  const { t } = useTranslation();
  const visibleRoles = roles ?? ROLE_ORDER;

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("routes.activeRoute.loadingRoute")}</p>;
  }

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? t("routes.activeRoute.crewRolesEmpty")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <ul className="divide-y divide-border">
        {employees.map((employee) => {
          const isDriver = employeeHasRole(employee, "driver");
          const isAppraiser = employeeHasRole(employee, "appraiser");
          const isHelper = toggleLeadRoles
            ? !isDriver && !isAppraiser
            : employeeHasRole(employee, "helper") && !isDriver && !isAppraiser;
          const selectedByRole: Record<RouteCrewRole, boolean> = {
            driver: isDriver,
            appraiser: isAppraiser,
            helper: isHelper,
          };

          return (
            <li
              key={employee.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{employee.name}</span>
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={t("routes.activeRoute.crewRoles")}
              >
                {visibleRoles.map((role) => {
                  const meta = ROLE_META[role];
                  const Icon = meta.icon;
                  const selected = selectedByRole[role];
                  const checkboxId = `crew-role-${employee.id}-${role}`;
                  return (
                    <label
                      key={role}
                      htmlFor={checkboxId}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium transition-colors",
                        selected
                          ? meta.accentClass
                          : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        className="size-3.5 accent-current"
                        checked={selected}
                        aria-label={t(meta.forKey, { name: employee.name })}
                        onChange={() => {
                          if (role === "helper" && selected) return;
                          onRoleChange(employee.id, role);
                        }}
                      />
                      <Icon className="size-3.5" />
                      {t(meta.labelKey)}
                    </label>
                  );
                })}
                {onRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(employee.id)}
                    aria-label={t("routes.form.removeCrewMember", { name: employee.name })}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
