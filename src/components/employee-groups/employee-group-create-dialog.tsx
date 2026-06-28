"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Search } from "lucide-react";
import { z } from "zod";

import { FormFooter } from "@/components/forms/form-shell";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  name: z.string().trim().min(1, "Group name is required."),
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

export function EmployeeGroupCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EmployeeGroupCreateDialogProps) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debouncedEmployeeQuery = useDebouncedValue(employeeQuery, 300).trim();
  const employeesQuery = useEmployees({
    ...DEFAULT_EMPLOYEE_LIST_PARAMS,
    limit: 200,
    active: true,
  });
  const employeeSearch = useEmployeeSearch(
    debouncedEmployeeQuery ? { value: debouncedEmployeeQuery } : undefined,
  );
  const createGroup = useCreateEmployeeGroup();
  const {
    register,
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
    selectedEmployees.forEach((employee) =>
      merged.set(employee.id, {
        id: employee.id,
        name: employee.name,
        title: "Selected",
        branch: "",
      }),
    );
    return Array.from(merged.values());
  }, [debouncedEmployeeQuery, employeeSearch.data?.items, employeesQuery.data?.items, selectedEmployees]);

  function handleDialogChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(defaultValues);
      setEmployeeQuery("");
      setSubmitError(null);
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
      const group = await createGroup.mutateAsync(values);
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
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Create employee group</DialogTitle>
          <DialogDescription>
            Create a crew and assign it to the delivery without leaving this form.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-employee-group-name">Group name</Label>
                <Input
                  id="new-employee-group-name"
                  placeholder="Delivery crew A"
                  autoFocus
                  {...register("name")}
                />
                {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-employee-group-branch">Branch</Label>
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

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="new-employee-group-search">Employees</Label>
                <Badge variant="secondary">{selectedEmployees.length} selected</Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-employee-group-search"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Search employees…"
                  className="pl-9"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border p-2">
                {employeeLoading && employees.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading employees…</p>
                ) : employees.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">No employees found.</p>
                ) : (
                  <div className="space-y-1.5">
                    {employees.map((employee) => {
                      const checked = selectedEmployees.some((entry) => entry.id === employee.id);
                      return (
                        <label
                          key={employee.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
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
                            className="mt-0.5 size-4 rounded border-input"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{employee.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {[employee.title, employee.branch].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.employees ? (
                <p className="text-xs text-destructive">{errors.employees.message}</p>
              ) : null}
            </div>
          </div>

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
