"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";
import { useEmployeeSearch, useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { DEFAULT_ROUTE_CREW_ROLE, type RouteEmployeeRef } from "@/lib/route-manager/types";

type RouteEmployeeSelectProps = {
  value: RouteEmployeeRef[];
  onChange: (employees: RouteEmployeeRef[]) => void;
  error?: string | null;
};

export function RouteEmployeeSelect({ value, onChange, error = null }: RouteEmployeeSelectProps) {
  const { t } = useTranslation();
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [pickerValue, setPickerValue] = useState("");
  const debouncedEmployeeQuery = useDebouncedValue(employeeQuery, 300).trim();
  const selectedIds = useMemo(() => new Set(value.map((employee) => employee.id)), [value]);

  const employeesQuery = useEmployees({
    ...DEFAULT_EMPLOYEE_LIST_PARAMS,
    limit: 200,
    active: true,
  });
  const employeeSearch = useEmployeeSearch(
    debouncedEmployeeQuery
      ? { field: "name", operator: "contains", value: debouncedEmployeeQuery }
      : undefined,
  );

  const availableEmployees = useMemo(() => {
    const merged = new Map<number, { id: number; name: string; title: string }>();
    const source = debouncedEmployeeQuery
      ? (employeeSearch.data?.items ?? [])
      : (employeesQuery.data?.items ?? []);

    source
      .filter((employee) => employee.active && !selectedIds.has(employee.id))
      .forEach((employee) =>
        merged.set(employee.id, {
          id: employee.id,
          name: employee.name,
          title: employee.title,
        }),
      );

    return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [
    debouncedEmployeeQuery,
    employeeSearch.data?.items,
    employeesQuery.data?.items,
    selectedIds,
  ]);

  const pickerOptions = useMemo(
    () =>
      availableEmployees.map((employee) => ({
        value: String(employee.id),
        label: employee.name,
        keywords: [employee.name, employee.title],
      })),
    [availableEmployees],
  );

  const employeeLoading =
    employeesQuery.isLoading ||
    (Boolean(employeeQuery.trim()) &&
      (employeeQuery.trim() !== debouncedEmployeeQuery || employeeSearch.isFetching));

  const sortedSelection = useMemo(
    () => [...value].sort((left, right) => left.name.localeCompare(right.name)),
    [value],
  );

  function addEmployee(employeeId: string) {
    if (!employeeId) return;

    const id = Number(employeeId);
    if (!Number.isInteger(id) || id <= 0 || selectedIds.has(id)) return;

    const fromList =
      availableEmployees.find((employee) => employee.id === id) ??
      employeesQuery.data?.items.find((employee) => employee.id === id) ??
      employeeSearch.data?.items.find((employee) => employee.id === id);

    onChange([...value, { id, name: fromList?.name ?? "", role: DEFAULT_ROUTE_CREW_ROLE }]);
    setPickerValue("");
    setEmployeeQuery("");
  }

  function removeEmployee(employeeId: number) {
    onChange(value.filter((employee) => employee.id !== employeeId));
  }

  return (
    <div className="space-y-3">
      <SearchableSelect
        id="route-employee-picker"
        aria-label={t("routes.form.crewMembers")}
        value={pickerValue}
        onValueChange={(next) => {
          setPickerValue(next);
          addEmployee(next);
        }}
        placeholder={t("routes.form.crewMemberPlaceholder")}
        searchPlaceholder={t("routes.form.searchCrewMembers")}
        emptyMessage={t("routes.form.noCrewMembersFound")}
        loadingMessage={t("routes.form.loadingCrewMembers")}
        loading={employeeLoading}
        manualFiltering={Boolean(debouncedEmployeeQuery)}
        onSearchChange={setEmployeeQuery}
        options={pickerOptions}
      />

      {sortedSelection.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
          {sortedSelection.map((employee) => (
            <li
              key={employee.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 font-medium">{employee.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeEmployee(employee.id)}
                aria-label={t("routes.form.removeCrewMember", { name: employee.name })}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("routes.form.selectAtLeastOneCrewMember")}</p>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
