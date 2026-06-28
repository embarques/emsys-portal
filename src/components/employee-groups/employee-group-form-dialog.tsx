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
import {
  useCreateEmployeeGroup,
  useUpdateEmployeeGroup,
} from "@/lib/employee-groups/hooks/use-employee-groups";
import { useEmployeeSearch, useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS, getEmployeePortalBranch } from "@/lib/employees/types";
import { getVehiclePortalBranch } from "@/lib/vehicles/types";
import { cn } from "@/lib/utils";

const employeeGroupFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a group name."),
  branch: z.enum(["usa", "dr"]),
  employees: z
    .array(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1) }))
    .min(1, "Select at least one employee."),
});

type EmployeeGroupFormValues = z.infer<typeof employeeGroupFormSchema>;

type EmployeeGroupFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this group; otherwise it creates a new one. */
  group?: EmployeeGroupOption | null;
  onCreated?: (group: EmployeeGroupOption) => void;
  onUpdated?: (group: EmployeeGroupOption) => void;
};

const defaultValues: EmployeeGroupFormValues = {
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

function groupToFormValues(group: EmployeeGroupOption): EmployeeGroupFormValues {
  return {
    name: group.name,
    branch: getVehiclePortalBranch(group.branch ?? "") === "dr" ? "dr" : "usa",
    employees: group.employees.map((employee) => ({ id: employee.id, name: employee.name })),
  };
}

export function EmployeeGroupFormDialog({
  open,
  onOpenChange,
  group,
  onCreated,
  onUpdated,
}: EmployeeGroupFormDialogProps) {
  const isEditing = Boolean(group);
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
  const updateGroup = useUpdateEmployeeGroup();
  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EmployeeGroupFormValues>({
    resolver: zodResolver(employeeGroupFormSchema),
    defaultValues,
  });
  const selectedEmployees = watch("employees");
  const branch = watch("branch");
  const name = watch("name");

  // Reset the form whenever the dialog opens so edit/create modes start clean.
  useEffect(() => {
    if (!open) return;
    if (group) {
      reset(groupToFormValues(group));
      setNameEdited(true);
    } else {
      reset(defaultValues);
      setNameEdited(false);
    }
    setEmployeeQuery("");
    setSubmitError(null);
  }, [open, group, reset]);

  const derivedName = useMemo(() => buildEmployeeGroupName(selectedEmployees), [selectedEmployees]);

  useEffect(() => {
    if (nameEdited) return;
    setValue("name", derivedName, { shouldValidate: true });
  }, [derivedName, nameEdited, setValue]);

  const employees = useMemo(() => {
    const merged = new Map<number, { id: number; name: string; title: string }>();
    const source = debouncedEmployeeQuery
      ? (employeeSearch.data?.items ?? [])
      : (employeesQuery.data?.items ?? []);

    source
      .filter((employee) => employee.active && getEmployeePortalBranch(employee) === branch)
      .forEach((employee) =>
        merged.set(employee.id, {
          id: employee.id,
          name: employee.name,
          title: employee.title,
        }),
      );
    selectedEmployees.forEach((employee) => {
      if (merged.has(employee.id)) return;
      merged.set(employee.id, {
        id: employee.id,
        name: employee.name,
        title: "",
      });
    });
    return Array.from(merged.values());
  }, [branch, debouncedEmployeeQuery, employeeSearch.data?.items, employeesQuery.data?.items, selectedEmployees]);

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
    const payload = {
      name: values.name.trim() || buildEmployeeGroupName(values.employees),
      branch: values.branch,
      employees: values.employees,
    };

    try {
      if (group) {
        const updated = await updateGroup.mutateAsync({ ...payload, id: group.id });
        onUpdated?.(updated);
      } else {
        const created = await createGroup.mutateAsync(payload);
        onCreated?.(created);
      }
      handleDialogChange(false);
    } catch (error) {
      setSubmitError(normalizeApiError(error).message);
    }
  });

  const employeeLoading =
    employeesQuery.isLoading ||
    (Boolean(employeeQuery.trim()) &&
      (employeeQuery.trim() !== debouncedEmployeeQuery || employeeSearch.isFetching));
  const isSubmitting = createGroup.isPending || updateGroup.isPending;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>{isEditing ? "Edit employee group" : "Create employee group"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <FormBody>
            <FormSection icon={Building2} title="Group">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="employee-group-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employee-group-name"
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

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="employee-group-branch">
                    Branch <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    id="employee-group-branch"
                    value={branch}
                    onValueChange={(value) => {
                      setValue("branch", value as EmployeeGroupFormValues["branch"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setValue("employees", [], { shouldDirty: true, shouldValidate: true });
                    }}
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
                <div className="flex items-center justify-end">
                  <Badge variant="secondary">{selectedEmployees.length} selected</Badge>
                </div>

                <Input
                  id="employee-group-search"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Search employees by name or role..."
                />

                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
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
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
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
                            className="size-4 rounded border-input"
                          />
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span className="font-medium">{employee.name}</span>
                            {employee.title ? (
                              <Badge variant="outline">{employee.title}</Badge>
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
            submitLabel={isEditing ? "Save changes" : "Create group"}
            isSubmitting={isSubmitting}
            onCancel={() => handleDialogChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
