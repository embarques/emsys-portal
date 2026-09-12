"use client";

import { useMemo } from "react";
import { Route, UserPlus } from "lucide-react";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildTransactionAssigneeOptions,
  dailyRoutesForStatement,
} from "@/lib/accounting/daily-income/assignee";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";
import type { DispatchFormValues, InventoryDispatchAssigneeSource } from "@/lib/inventory/types/documents";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type InventoryDispatchToSelectProps = {
  values: DispatchFormValues;
  employees: Employee[];
  dailyRoutes: ActiveRoute[];
  onChange: (patch: Partial<DispatchFormValues>) => void;
  onAddEmployee?: () => void;
  onEditEmployee?: () => void;
  onAddRoute?: () => void;
  onEditRoute?: () => void;
};

function emptyEmployeeFields(): Pick<DispatchFormValues, "employeeId" | "employeeName"> {
  return { employeeId: "", employeeName: "" };
}

function emptyRouteFields(): Pick<DispatchFormValues, "routeId" | "routeName" | "routeCrewId" | "routeCrewName"> {
  return { routeId: "", routeName: "", routeCrewId: "", routeCrewName: "" };
}

export function InventoryDispatchToSelect({
  values,
  employees,
  dailyRoutes,
  onChange,
  onAddEmployee,
  onEditEmployee,
  onAddRoute,
  onEditRoute,
}: InventoryDispatchToSelectProps) {
  const { t } = useTranslation();
  const source: InventoryDispatchAssigneeSource = values.assigneeSource === "route" ? "route" : "employee";
  const statementDate = values.dispatchedAt.slice(0, 10);

  const employeeOptions = useMemo(
    () => withPinnedSelectOption(buildTransactionAssigneeOptions(employees), values.employeeId, values.employeeName),
    [employees, values.employeeId, values.employeeName],
  );

  const routeOptions = useMemo(() => {
    const scoped = dailyRoutesForStatement(dailyRoutes, statementDate);
    const selected = values.routeId ? dailyRoutes.find((route) => route.id === values.routeId) : undefined;
    const list =
      selected && !scoped.some((route) => route.id === selected.id) ? [selected, ...scoped] : scoped;
    return withPinnedSelectOption(
      buildActiveRouteAssignmentOptions(list, t).map((option) => ({
        value: option.value,
        label: option.label,
        keywords: (option as { keywords?: string[] }).keywords,
      })),
      values.routeId,
      values.routeName,
    );
  }, [dailyRoutes, statementDate, t, values.routeId, values.routeName]);

  const sourceOptions = [
    { value: "employee", label: t("inventory.form.fields.employee") },
    { value: "route", label: t("inventory.form.fields.route") },
  ];

  function handleSourceChange(next: string) {
    const sourceValue: InventoryDispatchAssigneeSource = next === "route" ? "route" : "employee";
    onChange({
      assigneeSource: sourceValue,
      ...(sourceValue === "route" ? emptyEmployeeFields() : emptyRouteFields()),
    });
  }

  function handleEmployeeChange(next: string) {
    if (!next) {
      onChange({ assigneeSource: "employee", ...emptyEmployeeFields() });
      return;
    }
    const employee = employees.find((entry) => String(entry.id) === next);
    onChange({
      assigneeSource: "employee",
      employeeId: employee ? String(employee.id) : next,
      employeeName: employee?.name ?? "",
      ...emptyRouteFields(),
    });
  }

  function handleRouteChange(next: string) {
    if (!next) {
      onChange({ assigneeSource: "route", ...emptyRouteFields() });
      return;
    }
    const route = dailyRoutes.find((entry) => entry.id === next);
    const crewName =
      route?.route?.name.trim() ||
      route?.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
      "";
    onChange({
      assigneeSource: "route",
      routeId: route?.id ?? next,
      routeName: route?.name.trim() || crewName || next,
      routeCrewId: route?.route?.id || "",
      routeCrewName: crewName,
      ...emptyEmployeeFields(),
    });
  }

  return (
    <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="dispatchedTo-source">{t("inventory.form.fields.dispatchedTo")}</Label>
        <SearchableSelect
          id="dispatchedTo-source"
          value={source}
          onValueChange={handleSourceChange}
          placeholder={t("inventory.form.placeholders.selectAssigneeSource")}
          searchable={false}
          options={sourceOptions}
        />
      </div>
      {source === "route" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="dispatchedTo-route">{t("inventory.form.fields.route")}</Label>
            {onAddRoute ? (
              <FieldEntityActions
                hasSelection={Boolean(values.routeId)}
                onAdd={onAddRoute}
                onEdit={onEditRoute}
                addIcon={Route}
              />
            ) : null}
          </div>
          <SearchableSelect
            id="dispatchedTo-route"
            value={values.routeId}
            onValueChange={handleRouteChange}
            placeholder={t("inventory.form.placeholders.selectRoute")}
            searchPlaceholder={t("inventory.form.placeholders.searchRoutes")}
            options={routeOptions}
            selectAllOnFocus
            required
            mobileSheet
          />
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="dispatchedTo-employee">{t("inventory.form.fields.employee")}</Label>
            {onAddEmployee ? (
              <FieldEntityActions
                hasSelection={Boolean(values.employeeId)}
                onAdd={onAddEmployee}
                onEdit={onEditEmployee}
                addIcon={UserPlus}
              />
            ) : null}
          </div>
          <SearchableSelect
            id="dispatchedTo-employee"
            value={values.employeeId}
            onValueChange={handleEmployeeChange}
            placeholder={t("inventory.form.placeholders.selectEmployee")}
            searchPlaceholder={t("inventory.form.placeholders.searchEmployees")}
            options={employeeOptions}
            selectAllOnFocus
            required
            mobileSheet
          />
        </div>
      )}
    </div>
  );
}
