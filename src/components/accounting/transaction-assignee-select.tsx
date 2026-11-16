"use client";

import { useEffect, useMemo, useRef } from "react";
import { Route, UserCheck, UserPlus, UserRound, X } from "lucide-react";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { ChoiceTiles } from "@/components/ui/choice-tiles";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  buildDailyRouteSupervisorOptions,
  buildTransactionAssigneeOptions,
  dailyRoutesForAssigneeBranch,
  employeesForAssigneeBranch,
  getTransactionAssigneeSelectValue,
  isTodayOrYesterdayRouteDate,
  resolveDailyIncomeAssigneeSource,
  resolveDailyRouteSupervisor,
} from "@/lib/accounting/daily-income/assignee";
import { isDesktopFormNavigation } from "@/hooks/use-form-enter-navigation";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import type { DailyIncomeAssigneeSource } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";
import { assignmentToday } from "@/lib/pickup-delivery-routes/assignment-policy";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { formatRouteDate } from "@/lib/route-manager/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type Props = {
  inlineOptionsLimit?: number;
  id?: string;
  singleColumn?: boolean;
  /** Step-by-step entry: employee / daily route are tiles, and the matching picker appears once one is chosen. */
  guided?: boolean;
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  /** Closeout branch; employee and route options are limited to it. */
  statementBranchId?: number | null;
  employeeId?: number;
  employeeName?: string;
  routeId?: string;
  routeName?: string;
  supervisorId?: number;
  supervisorName?: string;
  assigneeSource?: DailyIncomeAssigneeSource;
  error?: string;
  supervisorError?: string;
  setValue: TransactionAssigneeSetValue;
  /** When false, only the employee picker is shown (invoice payment wizard). */
  allowDailyRoute?: boolean;
  onAddEmployee?: () => void;
  onEditEmployee?: () => void;
  onAddRoute?: () => void;
  onEditRoute?: () => void;
  /** Called when a choice completes the assignment (employee, or route with its supervisor). */
  onAssigneeComplete?: () => void;
};

type TransactionAssigneeFormValues = {
  assigneeSource?: DailyIncomeAssigneeSource;
  employeeId?: number;
  employeeName?: string;
  employeeGroupId?: string;
  employeeGroupName?: string;
  routeId?: string;
  routeName?: string;
  routeCrewId?: string;
  routeCrewName?: string;
  supervisorId?: number;
  supervisorName?: string;
};

type TransactionAssigneeSetValue = (
  name: keyof TransactionAssigneeFormValues,
  value: string | number | undefined,
  options?: { shouldValidate?: boolean },
) => void;

function clearEmployee(setValue: TransactionAssigneeSetValue) {
  setValue("employeeId", undefined, { shouldValidate: true });
  setValue("employeeName", "");
  setValue("employeeGroupId", undefined, { shouldValidate: true });
  setValue("employeeGroupName", "");
}

function setSupervisor(
  setValue: TransactionAssigneeSetValue,
  supervisor: { id: number; name: string } | null,
) {
  setValue("supervisorId", supervisor?.id, { shouldValidate: true });
  setValue("supervisorName", supervisor?.name ?? "");
}

function clearRoute(setValue: TransactionAssigneeSetValue) {
  setValue("routeId", undefined, { shouldValidate: true });
  setValue("routeName", "");
  setValue("routeCrewId", undefined, { shouldValidate: true });
  setValue("routeCrewName", "");
  setSupervisor(setValue, null);
}

export function TransactionAssigneeSelect({
  id = "journal-employee",
  singleColumn = false,
  guided = false,
  inlineOptionsLimit,
  employees,
  dailyRoutes = [],
  statementBranchId,
  employeeId,
  employeeName,
  routeId,
  routeName,
  supervisorId,
  supervisorName,
  assigneeSource,
  error,
  supervisorError,
  setValue,
  allowDailyRoute = true,
  onAddEmployee,
  onEditEmployee,
  onAddRoute,
  onEditRoute,
  onAssigneeComplete,
}: Props) {
  const { t } = useTranslation();

  const selectedRoute = useMemo(
    () => (routeId ? dailyRoutes.find((item) => item.id === routeId) : undefined),
    [dailyRoutes, routeId],
  );

  // The closeout belongs to one branch, so assignees are always scoped to it.
  const branchId = statementBranchId != null && statementBranchId > 0 ? statementBranchId : undefined;

  const source = allowDailyRoute
    ? resolveDailyIncomeAssigneeSource({ assigneeSource, employeeId, routeId })
    : "employee";
  // Guided flow defaults to the digitizing user ("creator"); pickers appear only for employee/route.
  const sourceChosen = !guided || !allowDailyRoute || Boolean(assigneeSource || employeeId || routeId?.trim());
  const showEmployeePicker = sourceChosen && source === "employee";
  const showRoutePicker = sourceChosen && source === "route";

  const branchScopedEmployees = useMemo(
    () => employeesForAssigneeBranch(employees, branchId),
    [branchId, employees],
  );
  const branchScopedRoutes = useMemo(
    () => dailyRoutesForAssigneeBranch(dailyRoutes, branchId),
    [branchId, dailyRoutes],
  );

  const today = assignmentToday();
  const isStaleRouteDate = (route?: ActiveRoute) =>
    Boolean(route?.date && !isTodayOrYesterdayRouteDate(route.date, today));
  const showStaleRouteWarning = source === "route" && isStaleRouteDate(selectedRoute);

  const employeeOptions = useMemo(
    () =>
      withPinnedSelectOption(
        buildTransactionAssigneeOptions(branchScopedEmployees),
        employeeId,
        employeeName,
      ),
    [branchScopedEmployees, employeeId, employeeName],
  );
  const routeOptions = useMemo(() => {
    const selected = routeId ? dailyRoutes.find((item) => item.id === routeId) : undefined;
    const list =
      selected && !branchScopedRoutes.some((item) => item.id === selected.id)
        ? [selected, ...branchScopedRoutes]
        : branchScopedRoutes;
    return withPinnedSelectOption(
      buildActiveRouteAssignmentOptions(list, t).map((option) => ({
        value: option.value,
        label: option.label,
        keywords: (option as { keywords?: string[] }).keywords,
      })),
      routeId,
      routeName,
    );
  }, [branchScopedRoutes, dailyRoutes, routeId, routeName, t]);

  // A route missing from the loaded list still needs an accountable supervisor.
  const supervisorOptions = useMemo(
    () =>
      withPinnedSelectOption(
        selectedRoute ? buildDailyRouteSupervisorOptions(selectedRoute) : buildTransactionAssigneeOptions(branchScopedEmployees),
        supervisorId,
        supervisorName,
      ),
    [branchScopedEmployees, selectedRoute, supervisorId, supervisorName],
  );
  const supervisorPlaceholder = t(
    routeId
      ? "accounting.dailyIncome.form.placeholders.selectSupervisor"
      : "accounting.dailyIncome.form.placeholders.selectRouteFirst",
  );
  const supervisorInline = getInlineSelectOptions({
    inlineOptionsLimit,
    options: supervisorOptions,
    value: supervisorId ? String(supervisorId) : "",
    placeholder: supervisorPlaceholder,
  }) !== null;

  // Fill the supervisor for prefilled routes; never replace one that was already recorded.
  useEffect(() => {
    if (source !== "route" || !selectedRoute || supervisorId) return;
    const supervisor = resolveDailyRouteSupervisor(selectedRoute);
    if (supervisor) setSupervisor(setValue, supervisor);
  }, [selectedRoute, setValue, source, supervisorId]);

  const employeeValue = getTransactionAssigneeSelectValue(employeeId);
  const sourceOptions: { value: DailyIncomeAssigneeSource; label: string }[] = allowDailyRoute
    ? [
        { value: "creator", label: t("accounting.dailyIncome.form.creatorAssignee") },
        { value: "employee", label: t("accounting.dailyIncome.form.fields.employee") },
        { value: "route", label: t("accounting.dailyIncome.form.fields.route") },
      ]
    : [{ value: "employee", label: t("accounting.dailyIncome.form.fields.employee") }];

  // Keep the form discriminator in sync with the default "Me" tile.
  useEffect(() => {
    if (!guided || !allowDailyRoute) return;
    if (assigneeSource || employeeId || routeId?.trim()) return;
    setValue("assigneeSource", "creator", { shouldValidate: false });
  }, [allowDailyRoute, assigneeSource, employeeId, guided, routeId, setValue]);

  const pendingSourceFocusRef = useRef<DailyIncomeAssigneeSource | null>(null);
  useEffect(() => {
    if (pendingSourceFocusRef.current !== source) return;
    pendingSourceFocusRef.current = null;
    if (!isDesktopFormNavigation() || source === "creator") return;
    // A newly mounted select swaps its control once the viewport resolves; focus the settled one.
    const frame = window.requestAnimationFrame(() => {
      const field = document.getElementById(source === "route" ? "journal-route" : id);
      if (!field || field.matches(":disabled") || field.getAttribute("aria-disabled") === "true") return;
      field.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [id, source]);

  function handleSourceChange(next: string) {
    const sourceValue: DailyIncomeAssigneeSource =
      next === "route" ? "route" : next === "creator" ? "creator" : "employee";
    pendingSourceFocusRef.current = sourceValue;
    setValue("assigneeSource", sourceValue, { shouldValidate: true });
    if (sourceValue === "route") {
      clearEmployee(setValue);
      return;
    }
    clearRoute(setValue);
    if (sourceValue === "creator") {
      clearEmployee(setValue);
      // Stay on Assignment so the operator can still switch to employee/route before continuing.
    }
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
    if (employee) onAssigneeComplete?.();
  }

  function handleRouteChange(next: string) {
    if (!next) {
      clearRoute(setValue);
      return;
    }

    const route = dailyRoutes.find((item) => item.id === next);
    const employeeNames =
      route?.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") || "";
    setValue("assigneeSource", "route", { shouldValidate: true });
    setValue("routeId", route?.id ?? next, { shouldValidate: true });
    setValue("routeName", route?.name.trim() || employeeNames || next);
    setValue("routeCrewId", undefined, { shouldValidate: true });
    setValue("routeCrewName", "");
    const supervisor = resolveDailyRouteSupervisor(route);
    setSupervisor(setValue, supervisor);
    clearEmployee(setValue);
    // Stay on Assignment when the stale-date warning is shown so the user can read it.
    if (supervisor && !isStaleRouteDate(route)) onAssigneeComplete?.();
  }

  function handleSupervisorChange(next: string) {
    const id = Number(next);
    if (!next || !Number.isInteger(id) || id <= 0) {
      setSupervisor(setValue, null);
      return;
    }
    const option = supervisorOptions.find((item) => item.value === next);
    setSupervisor(setValue, { id, name: option?.label ?? "" });
    const assignedRoute = routeId ? dailyRoutes.find((item) => item.id === routeId) : undefined;
    if (routeId && !isStaleRouteDate(assignedRoute)) onAssigneeComplete?.();
  }

  const sourceControl = !allowDailyRoute ? null : guided ? (
    <ChoiceTiles<DailyIncomeAssigneeSource>
      id={`${id}-source`}
      aria-label={t("accounting.dailyIncome.form.fields.assignedTo")}
      className="sm:grid-cols-3"
      value={sourceChosen ? source : "creator"}
      onValueChange={handleSourceChange}
      options={[
        {
          value: "creator",
          label: t("accounting.dailyIncome.form.creatorAssignee"),
          description: t("accounting.dailyIncome.form.assigneeSourceHints.creator"),
          icon: UserCheck,
          iconClassName: "text-emerald-700",
          iconBackgroundClassName: "bg-emerald-50 dark:bg-muted",
        },
        {
          value: "employee",
          label: t("accounting.dailyIncome.form.fields.employee"),
          description: t("accounting.dailyIncome.form.assigneeSourceHints.employee"),
          icon: UserRound,
          iconClassName: "text-blue-600",
          iconBackgroundClassName: "bg-blue-50 dark:bg-muted",
        },
        {
          value: "route",
          label: t("accounting.dailyIncome.form.fields.route"),
          description: t("accounting.dailyIncome.form.assigneeSourceHints.route"),
          icon: Route,
          iconClassName: "text-indigo-700",
          iconBackgroundClassName: "bg-indigo-50 dark:bg-muted",
        },
      ]}
    />
  ) : (
    <SegmentedControl
      id={`${id}-source`}
      aria-label={t("accounting.dailyIncome.form.fields.assignedTo")}
      value={source}
      onValueChange={handleSourceChange}
      options={sourceOptions}
    />
  );

  return (
    <div className={singleColumn ? "flex flex-col gap-4" : "grid gap-4 sm:grid-cols-2"}>
      {sourceControl}

      {showRoutePicker ? (
        <div className="space-y-2 sm:col-span-2">
          {onAddRoute ? (
            <div className="flex items-center justify-end gap-2">
              <FieldEntityActions
                hasSelection={Boolean(routeId)}
                onAdd={onAddRoute}
                onEdit={onEditRoute}
                addIcon={Route}
              />
            </div>
          ) : null}
          <SearchableSelect
            inlineOptionsLimit={inlineOptionsLimit}
            id="journal-route"
            aria-label={t("accounting.dailyIncome.form.fields.route")}
            value={routeId ?? ""}
            onValueChange={handleRouteChange}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectRoute")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchRoutes")}
            mobileSheet
            options={routeOptions}
          />
          {showStaleRouteWarning && selectedRoute?.date ? (
            <FormFooterNoticeMessage
              tone="warning"
              message={t("accounting.dailyIncome.form.warnings.staleDailyRoute", {
                date: formatRouteDate(selectedRoute.date),
              })}
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}

      {showRoutePicker ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:col-span-2">
          <div className="flex min-h-9 items-center justify-between gap-2">
            <Label htmlFor={`${id}-supervisor`} className="font-semibold text-foreground">
              {t("accounting.dailyIncome.form.fields.responsibleSupervisor")}
            </Label>
            {supervisorInline && supervisorId ? (
              <button type="button" disabled={!routeId}
                onClick={() => {
                  handleSupervisorChange("");
                  window.requestAnimationFrame(() => document.getElementById(`${id}-supervisor`)?.focus());
                }}
                className="flex min-h-9 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <X aria-hidden="true" className="size-3" />{t("common.ui.clearSelection")}
              </button>
            ) : null}
          </div>
          <SearchableSelect
            inlineOptionsLimit={inlineOptionsLimit}
            stretchInlineOptions
            clearable={false}
            id={`${id}-supervisor`}
            value={supervisorId ? String(supervisorId) : ""}
            onValueChange={handleSupervisorChange}
            placeholder={supervisorPlaceholder}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchSupervisors")}
            emptyMessage={t("accounting.dailyIncome.form.placeholders.noRouteSupervisors")}
            disabled={!routeId}
            mobileSheet
            options={supervisorOptions}
          />
          {supervisorError ? <p className="text-sm text-destructive">{supervisorError}</p> : null}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.hints.routeSupervisorAccountability")}
          </p>
        </div>
      ) : null}

      {showEmployeePicker ? (
        <div className="space-y-2 sm:col-span-2">
          {onAddEmployee ? (
            <div className="flex items-center justify-end gap-2">
              <FieldEntityActions
                hasSelection={Boolean(employeeId)}
                onAdd={onAddEmployee}
                onEdit={onEditEmployee}
                addIcon={UserPlus}
              />
            </div>
          ) : null}
          <SearchableSelect
            inlineOptionsLimit={inlineOptionsLimit}
            id={id}
            aria-label={t("accounting.dailyIncome.form.fields.employee")}
            value={employeeValue}
            onValueChange={handleEmployeeChange}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectEmployee")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchEmployees")}
            mobileSheet
            options={employeeOptions}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
