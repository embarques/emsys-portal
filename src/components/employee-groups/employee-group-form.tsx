"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { cloneEmployees } from "@/lib/employees/mock-data";
import { getEmployeeFullName, getEmployeeLabel } from "@/lib/employees/types";
import {
  createEmptyEmployeeGroupForm,
  EMPLOYEE_GROUP_BRANCHES,
  type EmployeeGroupFormValues,
} from "@/lib/employee-groups/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
  const employees = useMemo(() => cloneEmployees(), []);
  const [values, setValues] = useState<EmployeeGroupFormValues>(
    initialValues ?? createEmptyEmployeeGroupForm()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");

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

  const filteredEmployees = employees.filter((employee) => {
    const normalized = memberQuery.trim().toLowerCase();
    if (!normalized) return true;
    return getEmployeeLabel(employee).toLowerCase().includes(normalized);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="employeeGroupId">Employee group ID</Label>
          <Input
            id="employeeGroupId"
            value={values.employeeGroupId}
            readOnly
            className="bg-muted/40 font-mono text-xs"
          />
          {!isEditing ? (
            <p className="text-xs text-muted-foreground">Auto-generated ID for new groups.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Selected employees</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm">
            {values.employeeIds.length} selected
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                branch: event.target.value as EmployeeGroupFormValues["branch"],
              }))
            }
            required
          >
            {EMPLOYEE_GROUP_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">
            Employees <span className="text-destructive">*</span>
          </h3>
          <p className="text-sm text-muted-foreground">Select one or more employees for this group.</p>
        </div>

        <Input
          value={memberQuery}
          onChange={(event) => setMemberQuery(event.target.value)}
          placeholder="Search employees by name or role..."
        />

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((employee) => {
              const checked = values.employeeIds.includes(employee.employeeId);
              return (
                <label
                  key={employee.employeeId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleEmployee(employee.employeeId, event.target.checked)}
                    className="mt-1 size-4 rounded border-input"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{getEmployeeFullName(employee)}</span>
                      <Badge variant="outline">{employee.role}</Badge>
                      {employee.status === "inactive" ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {employee.department} · {employee.branch || "No branch"}
                    </p>
                  </div>
                </label>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No employees match your search.</p>
          )}
        </div>
      </section>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => setValues((current) => ({ ...current, createdBy: value }))}
      />

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
