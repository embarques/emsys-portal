"use client";

import { Building2, Users } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getEmployeeBranchLabel } from "@/lib/employees/display";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import {
  createEmployeeSearchFilter,
  getEmployeeFullName,
  getEmployeePortalBranch,
} from "@/lib/employees/types";
import {
  createEmptyEmployeeGroupForm,
  EMPLOYEE_GROUP_BRANCHES,
  type EmployeeGroupFormValues,
} from "@/lib/employee-groups/types";
import { cn } from "@/lib/utils";

type EmployeeGroupFormProps = {
  initialValues?: EmployeeGroupFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: EmployeeGroupFormValues) => void;
  onCancel: () => void;
};

export function EmployeeGroupForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeGroupFormProps) {
  const [values, setValues] = useState<EmployeeGroupFormValues>(
    initialValues ?? createEmptyEmployeeGroupForm()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const deferredMemberQuery = useDeferredValue(memberQuery);
  const memberSearch = createEmployeeSearchFilter(deferredMemberQuery, "name", "startsWith");
  const employeesQuery = useEmployees({
    page: 1,
    limit: 40,
    sort: "name:asc",
    search: memberSearch,
  });
  const employees = employeesQuery.data?.items ?? [];
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyEmployeeGroupForm());
    setFormError(null);
    setMemberQuery("");
  }, [initialValues]);

  function toggleEmployee(employeeId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      employeeIds: checked
        ? Array.from(new Set([...current.employeeIds, employeeId]))
        : current.employeeIds.filter((id) => id !== employeeId),
    }));
    setFormError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (values.employeeIds.length === 0) {
      setFormError("Select at least one employee for this group.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={Building2} title="Group">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Selected employees</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm">
                {values.employeeIds.length} selected
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="branch">
                Branch <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="branch"
                value={values.branch}
                onValueChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    branch: next as EmployeeGroupFormValues["branch"],
                  }))
                }
                searchPlaceholder="Search branches…"
                required
                options={EMPLOYEE_GROUP_BRANCHES.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Users} title="Members" required>
          <div className="space-y-2.5">
            <Input
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Search employees by name or role..."
            />

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
              {employeesQuery.isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading employees…</p>
          ) : employees.length > 0 ? (
            employees.map((employee) => {
              const checked = values.employeeIds.includes(String(employee.id));
              return (
                <label
                  key={employee.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleEmployee(String(employee.id), event.target.checked)}
                    className="mt-1 size-4 rounded border-input"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{getEmployeeFullName(employee)}</span>
                      <Badge variant="outline">{employee.title}</Badge>
                      {!employee.active ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {employee.department} · {getEmployeeBranchLabel(getEmployeePortalBranch(employee))}
                    </p>
                  </div>
                </label>
              );
            })
              ) : (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No employees match your search.</p>
              )}
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={formError} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
