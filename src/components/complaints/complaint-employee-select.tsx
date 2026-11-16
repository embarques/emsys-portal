"use client";

import { useMemo, useState } from "react";

import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmployeeSearch, useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";

type ComplaintEmployeeSelectProps = {
  id: string;
  value: string;
  onChange: (employeeId: string) => void;
  disabled?: boolean;
  invalid?: boolean;
};

/** Active employee directory picker; complaint targets store the numeric `employeeId`. */
export function ComplaintEmployeeSelect({ id, value, onChange, disabled, invalid }: ComplaintEmployeeSelectProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300).trim();
  const [picked, setPicked] = useState<SearchableSelectOption | null>(null);

  const list = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200, active: true });
  const search = useEmployeeSearch(
    debouncedQuery ? { field: "name", operator: "contains", value: debouncedQuery } : undefined,
  );

  const options = useMemo(() => {
    const source = debouncedQuery ? (search.data?.items ?? []) : (list.data?.items ?? []);
    const built: SearchableSelectOption[] = source
      .filter((employee) => employee.active)
      .map((employee) => ({
        value: String(employee.id),
        label: employee.name,
        description: employee.title || undefined,
      }));
    if (value && picked?.value === value && !built.some((option) => option.value === value)) built.unshift(picked);
    return built;
  }, [debouncedQuery, list.data?.items, picked, search.data?.items, value]);

  return (
    <SearchableSelect
      id={id}
      options={options}
      value={value}
      onValueChange={(next) => {
        setPicked(options.find((option) => option.value === next) ?? null);
        onChange(next);
      }}
      onSearchChange={setQuery}
      manualFiltering={Boolean(debouncedQuery)}
      loading={debouncedQuery ? search.isFetching : list.isLoading}
      disabled={disabled}
      aria-invalid={invalid}
      placeholder={t("complaints.form.employeePlaceholder")}
      searchPlaceholder={t("complaints.form.employeeSearch")}
      emptyMessage={t("complaints.form.employeeEmpty")}
    />
  );
}
