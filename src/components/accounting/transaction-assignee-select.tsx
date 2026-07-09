"use client";

import { useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildTransactionAssigneeOptions,
  getTransactionAssigneeSelectValue,
} from "@/lib/accounting/daily-income/assignee";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  id?: string;
  employees: Employee[];
  employeeId?: number;
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
  employeeId,
  error,
  setValue,
}: Props) {
  const { t } = useTranslation();
  const options = useMemo(() => buildTransactionAssigneeOptions(employees), [employees]);
  const value = getTransactionAssigneeSelectValue(employeeId);

  function handleValueChange(next: string) {
    if (!next) {
      setValue("employeeId", undefined, { shouldValidate: true });
      setValue("employeeName", "");
      setValue("employeeGroupId", undefined, { shouldValidate: true });
      setValue("employeeGroupName", "");
      return;
    }

    const employee = employees.find((item) => String(item.id) === next);
    setValue("employeeId", employee?.id, { shouldValidate: true });
    setValue("employeeName", employee?.name ?? "");
    setValue("employeeGroupId", undefined, { shouldValidate: true });
    setValue("employeeGroupName", "");
  }

  return (
    <div className="space-y-2">
      <RequiredLabel htmlFor={id}>{t("accounting.dailyIncome.form.fields.employee")}</RequiredLabel>
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={handleValueChange}
        placeholder={t("accounting.dailyIncome.form.placeholders.selectEmployee")}
        searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchEmployees")}
        options={options}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
