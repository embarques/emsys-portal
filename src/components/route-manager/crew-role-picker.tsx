"use client";

import { Car, ClipboardList, Hand, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  resolveCrewRole,
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
  loading?: boolean;
  emptyMessage?: string;
};

const ROLE_META: Record<
  RouteCrewRole,
  { icon: LucideIcon; labelKey: string; activeClass: string; roundedClass: string }
> = {
  driver: {
    icon: Car,
    labelKey: "routes.activeRoute.driver",
    activeClass: "bg-emerald-600 text-white",
    roundedClass: "rounded-l-lg",
  },
  appraiser: {
    icon: ClipboardList,
    labelKey: "routes.activeRoute.appraiser",
    activeClass: "bg-blue-600 text-white",
    roundedClass: "rounded-none",
  },
  helper: {
    icon: Hand,
    labelKey: "routes.activeRoute.helper",
    activeClass: "bg-amber-600 text-white",
    roundedClass: "rounded-r-lg",
  },
};

const ROLE_ORDER: RouteCrewRole[] = ["driver", "appraiser", "helper"];

export function CrewRolePicker({
  employees,
  onRoleChange,
  onRemove,
  roles,
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
          const activeRole = resolveCrewRole(employee.role);
          return (
            <li
              key={employee.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{employee.name}</span>
              <div
                className="inline-flex shrink-0 items-center"
                role="group"
                aria-label={t("routes.activeRoute.crewRoles")}
              >
                {visibleRoles.map((role, index) => {
                  const meta = ROLE_META[role];
                  const Icon = meta.icon;
                  const selected = activeRole === role;
                  const rounded = cn(
                    index === 0 && "rounded-l-lg",
                    index === visibleRoles.length - 1 && "rounded-r-lg",
                  );
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onRoleChange(employee.id, role)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        rounded,
                        selected ? meta.activeClass : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {t(meta.labelKey)}
                    </button>
                  );
                })}
                {onRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-1 size-8 shrink-0 text-muted-foreground hover:text-destructive"
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
