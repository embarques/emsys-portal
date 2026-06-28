"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, Users } from "lucide-react";
import { z } from "zod";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import { useCreateEmployeeGroup } from "@/lib/employee-groups/hooks/use-employee-groups";
import { getEmployeeBranchLabel } from "@/lib/employees/display";
import { useEmployeeSearch, useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS, getEmployeePortalBranch } from "@/lib/employees/types";
import { cn } from "@/lib/utils";

const employeeGroupCreateSchema = z.object({
  name: z.string().trim().min(1, "Enter a group name."),
  branch: z.enum(["usa", "dr"]),
  employees: z
    .array(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1) }))
    .min(1, "Select at least one employee."),
});

type EmployeeGroupCreateValues = z.infer<typeof employeeGroupCreateSchema>;

type EmployeeGroupCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: EmployeeGroupOption) => void;
};

const defaultValues: EmployeeGroupCreateValues = {
  name: "",
  branch: "usa",
  employees: [],
};

/** Group name is derived from its members (e.g. "John Doe, Jane Smith"). */
function buildEmployeeGroupName(employees: { name: string }[]): string {
  return employees
    .map((employee) => employee.name.trim())
    .filter(Boolean)
    .join(", ");
}

export function EmployeeGroupCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EmployeeGroupCreateDialogProps) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const debouncedEmployeeQuery = useDebouncedValue(employeeQuery, 300).trim();
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
  const createGroup = useCreateEmployeeGroup();
  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EmployeeGroupCreateValues>({
    resolver: zodResolver(employeeGroupCreateSchema),
    defaultValues,
  });
  const selectedEmployees = watch("employees");
  const branch = watch("branch");
  const name = watch("name");

  const derivedName = useMemo(() => buildEmployeeGroupName(selectedEmployees), [selectedEmployees]);

  useEffect(() => {
    if (nameEdited) return;
    setValue("name", derivedName, { shouldValidate: true });
  }, [derivedName, nameEdited, setValue]);

  const employees = useMemo(() => {
    const merged = new Map<number, { id: number; name: string; title: string; branch: string }>();
    const source = debouncedEmployeeQuery
      ? (employeeSearch.data?.items ?? [])
      : (employeesQuery.data?.items ?? []);

    source
      .filter((employee) => employee.active)
      .forEach((employee) =>
        merged.set(employee.id, {
          id: employee.id,
          name: employee.name,
          title: employee.title,
          branch: getEmployeeBranchLabel(getEmployeePortalBranch(employee)),
        }),
      );
    selectedEmployees.forEach((employee) => {
      if (merged.has(employee.id)) return;
      merged.set(employee.id, {
        id: employee.id,
        name: employee.name,
        title: "",
        branch: "",
      });
    });
    return Array.from(merged.values());
  }, [debouncedEmployeeQuery, employeeSearch.data?.items, employeesQuery.data?.items, selectedEmployees]);

  function handleDialogChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(defaultValues);
      setEmployeeQuery("");
      setSubmitError(null);
      setNameEdited(false);
    }
    onOpenChange(nextOpen);
  }

  function toggleEmployee(employee: { id: number; name: string }, checked: boolean) {
    setValue(
      "employees",
      checked
        ? [...selectedEmployees, employee]
        : selectedEmployees.filter((entry) => entry.id !== employee.id),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const group = await createGroup.mutateAsync({
        name: values.name.trim() || buildEmployeeGroupName(values.employees),
        branch: values.branch,
        employees: values.employees,
      });
      onCreated(group);
      handleDialogChange(false);
    } catch (error) {
      setSubmitError(normalizeApiError(error).message);
    }
  });

  const employeeLoading =
    employeesQuery.isLoading ||
    (Boolean(employeeQuery.trim()) &&
      (employeeQuery.trim() !== debouncedEmployeeQuery || employeeSearch.isFetching));

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Create employee group</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <FormBody>
            <FormSection icon={Building2} title="Group">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="new-employee-group-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-employee-group-name"
                    value={name}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNameEdited(value.trim().length > 0);
                      setValue("name", value, { shouldDirty: true, shouldValidate: true });
                    }}
                    placeholder="Auto-filled from selected employees"
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label>Selected employees</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm">
                    {selectedEmployees.length} selected
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-employee-group-branch">
                    Branch <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    id="new-employee-group-branch"
                    value={branch}
                    onValueChange={(value) =>
                      setValue("branch", value as EmployeeGroupCreateValues["branch"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    searchable={false}
                    options={[
                      { value: "usa", label: "USA" },
                      { value: "dr", label: "Dominican Republic" },
                    ]}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection icon={Users} title="Members" required>
              <div className="space-y-2.5">
                <Input
                  id="new-employee-group-search"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Search employees by name or role..."
                />

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {employeeLoading && employees.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading employees…</p>
                  ) : employees.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">No employees found.</p>
                  ) : (
                    employees.map((employee) => {
                      const checked = selectedEmployees.some((entry) => entry.id === employee.id);
                      return (
                        <label
                          key={employee.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            checked ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              toggleEmployee(
                                { id: employee.id, name: employee.name },
                                event.target.checked,
                              )
                            }
                            className="mt-1 size-4 rounded border-input"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{employee.name}</span>
                              {employee.title ? (
                                <Badge variant="outline">{employee.title}</Badge>
                              ) : null}
                            </div>
                            {employee.branch ? (
                              <p className="mt-1 text-xs text-muted-foreground">{employee.branch}</p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {errors.employees ? (
                  <p className="text-xs text-destructive">{errors.employees.message}</p>
                ) : null}
              </div>
            </FormSection>
          </FormBody>

          <FormFooter
            error={submitError}
            submitLabel="Create group"
            isSubmitting={createGroup.isPending}
            onCancel={() => handleDialogChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
