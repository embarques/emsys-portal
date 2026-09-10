"use client";

import { useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildTransactionAssigneeOptions,
  dailyRoutesForStatement,
  getTransactionAssigneeSelectValue,
  resolveDailyIncomeAssigneeSource,
} from "@/lib/accounting/daily-income/assignee";
import type {
  DailyIncomeAssigneeSource,
  DailyIncomeJournalValues,
} from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type Props = {
  id?: string;
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  employeeId?: number;
  routeId?: string;
  assigneeSource?: DailyIncomeAssigneeSource;
  error?: string;
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  /** When false, only the employee picker is shown (invoice payment wizard). */
  allowDailyRoute?: boolean;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

function clearEmployee(setValue: UseFormSetValue<DailyIncomeJournalValues>) {
  setValue("employeeId", undefined, { shouldValidate: true });
  setValue("employeeName", "");
  setValue("employeeGroupId", undefined, { shouldValidate: true });
  setValue("employeeGroupName", "");
}

function clearRoute(setValue: UseFormSetValue<DailyIncomeJournalValues>) {
  setValue("routeId", undefined, { shouldValidate: true });
  setValue("routeName", "");
  setValue("routeCrewId", undefined, { shouldValidate: true });
  setValue("routeCrewName", "");
}

export function TransactionAssigneeSelect({
  id = "journal-employee",
  employees,
  dailyRoutes = [],
  statementDate,
  employeeId,
  routeId,
  assigneeSource,
  error,
  setValue,
  allowDailyRoute = true,
}: Props) {
  const { t } = useTranslation();
  const source = allowDailyRoute
    ? resolveDailyIncomeAssigneeSource({ assigneeSource, employeeId, routeId })
    : "employee";
  const employeeOptions = useMemo(() => buildTransactionAssigneeOptions(employees), [employees]);
  const routeOptions = useMemo(() => {
    const scoped = dailyRoutesForStatement(dailyRoutes, statementDate);
    const selected = routeId ? dailyRoutes.find((item) => item.id === routeId) : undefined;
    const list =
      selected && !scoped.some((item) => item.id === selected.id) ? [selected, ...scoped] : scoped;
    return buildActiveRouteAssignmentOptions(list, t).map((option) => ({
      value: option.value,
      label: option.label,
      keywords: option.keywords,
    }));
  }, [dailyRoutes, routeId, statementDate, t]);
  const employeeValue = getTransactionAssigneeSelectValue(employeeId);
  const sourceOptions = [
    { value: "employee", label: t("accounting.dailyIncome.form.fields.employee") },
    { value: "route", label: t("accounting.dailyIncome.form.fields.route") },
  ];

  function handleSourceChange(next: string) {
    const sourceValue = next === "route" ? "route" : "employee";
    setValue("assigneeSource", sourceValue, { shouldValidate: true });
    if (sourceValue === "route") {
      clearEmployee(setValue);
      return;
    }
    clearRoute(setValue);
  }

  function handleEmployeeChange(next: string) {
    if (!next) {
      clearEmployee(setValue);
      return;
    }

    const employee = employees.find((item) => String(item.id) === next);
    setValue("assigneeSource", "employee", { shouldValidate: true });
    setValue("employeeId", employee?.id, { shouldValidate: true });
    setValue("employeeName", employee?.name ?? "");
    setValue("employeeGroupId", undefined, { shouldValidate: true });
    setValue("employeeGroupName", "");
    clearRoute(setValue);
  }

  function handleRouteChange(next: string) {
    if (!next) {
      clearRoute(setValue);
      return;
    }

    const route = dailyRoutes.find((item) => item.id === next);
    const crewName =
      route?.route?.name.trim() ||
      route?.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
      "";
    setValue("assigneeSource", "route", { shouldValidate: true });
    setValue("routeId", route?.id ?? next, { shouldValidate: true });
    setValue("routeName", route?.name.trim() || crewName || next);
    setValue("routeCrewId", route?.route?.id || undefined, { shouldValidate: true });
    setValue("routeCrewName", crewName);
    clearEmployee(setValue);
  }

  return (
    <div className={allowDailyRoute ? "grid gap-4 sm:grid-cols-2" : "space-y-2"}>
      {allowDailyRoute ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-source`}>
            {t("accounting.dailyIncome.form.fields.assignedTo")}
          </RequiredLabel>
          <SearchableSelect
            id={`${id}-source`}
            value={source}
            onValueChange={handleSourceChange}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectAssigneeSource")}
            searchable={false}
            options={sourceOptions}
          />
        </div>
      ) : null}
      {source === "route" ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor="journal-route">
            {t("accounting.dailyIncome.form.fields.route")}
          </RequiredLabel>
          <SearchableSelect
            id="journal-route"
            value={routeId ?? ""}
            onValueChange={handleRouteChange}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectRoute")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchRoutes")}
            mobileSheet
            options={routeOptions}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <RequiredLabel htmlFor={id}>{t("accounting.dailyIncome.form.fields.employee")}</RequiredLabel>
          <SearchableSelect
            id={id}
            value={employeeValue}
            onValueChange={handleEmployeeChange}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectEmployee")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchEmployees")}
            mobileSheet
            options={employeeOptions}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
