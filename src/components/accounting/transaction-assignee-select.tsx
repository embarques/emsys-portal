"use client";

import { useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildTransactionAssigneeOptions,
  decodeTransactionAssigneeValue,
  getTransactionAssigneeSelectValue,
} from "@/lib/accounting/daily-income/assignee";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import type { Employee } from "@/lib/employees/types";

type Props = {
  id?: string;
  employees: Employee[];
  employeeGroups: EmployeeGroupOption[];
  employeeId?: number;
  employeeGroupId?: string;
  groupsOnly?: boolean;
  error?: string;
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

export function TransactionAssigneeSelect({
  id = "journal-employee",
  employees,
  employeeGroups,
  employeeId,
  employeeGroupId,
  groupsOnly = false,
  error,
  setValue,
}: Props) {
  const options = useMemo(
    () => buildTransactionAssigneeOptions(employees, employeeGroups, { groupsOnly }),
    [employeeGroups, employees, groupsOnly],
  );
  const value = getTransactionAssigneeSelectValue(employeeId, employeeGroupId);

  function handleValueChange(next: string) {
    const selection = decodeTransactionAssigneeValue(next);
    if (!selection) {
      setValue("employeeId", undefined, { shouldValidate: true });
      setValue("employeeName", "");
      setValue("employeeGroupId", undefined, { shouldValidate: true });
      setValue("employeeGroupName", "");
      return;
    }

    if (selection.type === "employee") {
      const employee = employees.find((item) => String(item.id) === selection.id);
      setValue("employeeId", employee?.id, { shouldValidate: true });
      setValue("employeeName", employee?.name ?? "");
      setValue("employeeGroupId", undefined, { shouldValidate: true });
      setValue("employeeGroupName", "");
      return;
    }

    const group = employeeGroups.find((item) => item.id === selection.id);
    setValue("employeeGroupId", group?.id, { shouldValidate: true });
    setValue("employeeGroupName", group?.name?.trim() || group?.employeeGroupId || "");
    setValue("employeeId", undefined, { shouldValidate: true });
    setValue("employeeName", "");
  }

  return (
    <div className="space-y-2">
      <RequiredLabel htmlFor={id}>
        {groupsOnly ? "Employee group" : "Employee or employee group"}
      </RequiredLabel>
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={handleValueChange}
        placeholder={groupsOnly ? "Select employee group" : "Select employee or employee group"}
        searchPlaceholder={groupsOnly ? "Search employee groups…" : "Search employees or groups…"}
        options={options}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
