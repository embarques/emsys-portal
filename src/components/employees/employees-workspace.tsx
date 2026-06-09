"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeViewSheet } from "@/components/employees/employee-view-sheet";
import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import { formatAuditDate } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatEmployeeBranchLabel,
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeeUserLabel,
  getEmployeeActiveBadgeClass,
  getEmployeeActiveLabel,
  getEmployeeBranchBadgeClass,
} from "@/lib/employees/display";
import {
  useCreateEmployee,
  useDeleteEmployees,
  useEmployeeStats,
  useEmployees,
  useUpdateEmployee,
} from "@/lib/employees/hooks/use-employees";
import {
  DEFAULT_EMPLOYEE_LIST_PARAMS,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_SEARCH_FIELDS,
  createEmployeeSearchFilter,
  createEmptyEmployeeForm,
  employeeToFormValues,
  getDefaultEmployeeSearchOperator,
  getEmployeeSearchOperatorsForField,
  getEmployeeSearchSortField,
  type Employee,
  type EmployeeFilterState,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_EMPLOYEE_LIST_PARAMS.limit;

const defaultFilters: EmployeeFilterState = {
  query: "",
  searchField: "name",
  searchOperator: "startsWith",
  branch: "all",
  active: "all",
  department: "all",
};

export function EmployeesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<EmployeeFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | Employee[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => {
      const search = createEmployeeSearchFilter(deferredQuery, filters.searchField, filters.searchOperator);

      return {
        ...DEFAULT_EMPLOYEE_LIST_PARAMS,
        page,
        limit: PAGE_SIZE,
        sortField: search ? getEmployeeSearchSortField(filters.searchField) : "name",
        search,
        branch: filters.branch,
        active: filters.active,
        department: filters.department,
      };
    },
    [
      deferredQuery,
      filters.branch,
      filters.department,
      filters.searchField,
      filters.searchOperator,
      filters.active,
      page,
    ],
  );

  const { data, isLoading, isError, error, isFetching } = useEmployees(listParams);
  const { data: branchesData } = useBranchPicker();
  const stats = useEmployeeStats();
  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deleteEmployeesMutation = useDeleteEmployees();

  const employees = data?.items ?? [];
  const totalEmployees = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    employees.length > 0 && employees.every((employee) => selectedIds.includes(String(employee.id)));
  const isSaving =
    createEmployeeMutation.isPending ||
    updateEmployeeMutation.isPending ||
    deleteEmployeesMutation.isPending;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...employees.map((employee) => String(employee.id))])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !employees.some((employee) => String(employee.id) === id)),
    );
  }

  function toggleSelect(employeeId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, employeeId] : current.filter((entry) => entry !== employeeId),
    );
  }

  function openAddForm() {
    setEditingEmployee(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);
    setFormMode("edit");
    setViewEmployee(null);
    setFormError(null);
  }

  async function saveEmployee(values: EmployeeFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingEmployee) {
        const nextEmployee = await updateEmployeeMutation.mutateAsync({
          employeeId: String(editingEmployee.id),
          values,
        });
        notifyUpdated("Employee", nextEmployee.name);
      } else {
        const nextEmployee = await createEmployeeMutation.mutateAsync(values);
        notifyAdded("Employee", nextEmployee.name);
      }

      setFormMode(null);
      setEditingEmployee(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((employee) => String(employee.id))
      : [String(deleteTarget.id)];

    try {
      await deleteEmployeesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewEmployee(null);
      notifyDeleted("Employee", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total employees",
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: "Employees on record",
      icon: Users,
    },
    {
      label: "Active",
      value: stats.isLoading ? "…" : stats.active.toString(),
      description: "Currently active",
      icon: UserRound,
    },
    {
      label: "Inactive",
      value: stats.isLoading ? "…" : stats.inactive.toString(),
      description: "No longer active",
      icon: UserRound,
    },
  ];

  const branchFilters = useMemo(() => {
    const apiBranches = branchesData?.items ?? [];

    return [
      { value: "all" as const, label: "All branches" },
      ...apiBranches.map((branch) => ({
        value: branch.id,
        label: formatBranchFilterLabel(branch),
      })),
    ];
  }, [branchesData?.items]);

  const activeFilters: { value: EmployeeFilterState["active"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];

  const departmentFilters = [
    { value: "all", label: "All departments" },
    ...EMPLOYEE_DEPARTMENTS.map((department) => ({ value: department, label: department })),
  ];

  const tableColumns: DataTableColumn<Employee>[] = [
    {
      id: "id",
      label: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (employee) => formatEmployeeId(employee.id),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (employee) => employee.name,
    },
    {
      id: "title",
      label: "title",
      renderCell: (employee) => employee.title || "—",
    },
    {
      id: "department",
      label: "department",
      renderCell: (employee) => employee.department || "—",
    },
    {
      id: "active",
      label: "active",
      renderCell: (employee) => (
        <Badge className={getEmployeeActiveBadgeClass(employee.active)}>
          {getEmployeeActiveLabel(employee.active)}
        </Badge>
      ),
    },
    {
      id: "startDate",
      label: "startDate",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => (employee.startDate ? formatAuditDate(employee.startDate) : "—"),
    },
    {
      id: "endDate",
      label: "endDate",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => (employee.endDate ? formatAuditDate(employee.endDate) : "—"),
    },
    {
      id: "branch",
      label: "branch",
      renderCell: (employee) => (
        <Badge className={getEmployeeBranchBadgeClass(employee)}>
          {formatEmployeeBranchLabel(employee)}
        </Badge>
      ),
    },
    {
      id: "branch.code",
      label: "branch.code",
      renderCell: (employee) => employee.branch.code || "—",
    },
    {
      id: "branch.name",
      label: "branch.name",
      renderCell: (employee) => employee.branch.name || "—",
    },
    {
      id: "phone1",
      label: "phone1",
      renderCell: (employee) => formatPhoneDisplayOrDash(employee.phone1),
    },
    {
      id: "phone2",
      label: "phone2",
      renderCell: (employee) => formatPhoneDisplayOrDash(employee.phone2),
    },
    {
      id: "email",
      label: "email",
      renderCell: (employee) => employee.email || "—",
    },
    {
      id: "address.address1",
      label: "address.address1",
      renderCell: (employee) => employee.address.address1 || "—",
    },
    {
      id: "address.city",
      label: "address.city",
      renderCell: (employee) => employee.address.city || "—",
    },
    {
      id: "address.state",
      label: "address.state",
      renderCell: (employee) => employee.address.state || "—",
    },
    {
      id: "address.country",
      label: "address.country",
      renderCell: (employee) => employee.address.country || "—",
    },
    {
      id: "cost",
      label: "cost",
      renderCell: (employee) => formatEmployeeMoney(employee.cost),
    },
    {
      id: "totalLoanGiven",
      label: "totalLoanGiven",
      renderCell: (employee) => formatEmployeeMoney(employee.totalLoanGiven),
    },
    {
      id: "totalPaymentReceived",
      label: "totalPaymentReceived",
      renderCell: (employee) => formatEmployeeMoney(employee.totalPaymentReceived),
    },
    {
      id: "loanAmountOwed",
      label: "loanAmountOwed",
      renderCell: (employee) => formatEmployeeMoney(employee.loanAmountOwed),
    },
    {
      id: "loanBalanceUpdated",
      label: "loanBalanceUpdated",
      renderCell: (employee) =>
        employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : "—",
    },
    {
      id: "user",
      label: "user",
      renderCell: (employee) => formatEmployeeUserLabel(employee),
    },
    {
      id: "user.id",
      label: "user.id",
      cellClassName: "font-mono text-xs",
      renderCell: (employee) => (employee.user?.id ? String(employee.user.id) : "—"),
    },
    {
      id: "user.userName",
      label: "user.userName",
      renderCell: (employee) => employee.user?.userName || "—",
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => (employee.createdAt ? formatAuditDate(employee.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => (employee.updatedAt ? formatAuditDate(employee.updatedAt) : "—"),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (employee) => (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(employee)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setViewEmployee(null);
              setDeleteTarget(employee);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("employees", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const searchOperatorOptions = useMemo(
    () =>
      getEmployeeSearchOperatorsForField(filters.searchField).map((operator) => ({
        value: operator,
        label:
          operator === "startsWith"
            ? "Starts with"
            : operator === "contains"
              ? "Contains"
              : operator === "eq"
                ? "Equals"
                : "Not equals",
      })),
    [filters.searchField],
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee records with branch, address, schedule, loans, and linked users."
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add employee
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Employee directory</CardTitle>
              <CardDescription>Search and filter employees by branch, department, title, and active.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  const searchField = event.target.value as EmployeeFilterState["searchField"];
                  setFilters((current) => {
                    const allowedOperators = getEmployeeSearchOperatorsForField(searchField);
                    const searchOperator = allowedOperators.includes(current.searchOperator)
                      ? current.searchOperator
                      : getDefaultEmployeeSearchOperator(searchField);

                    return {
                      ...current,
                      searchField,
                      searchOperator,
                    };
                  });
                  setPage(1);
                }}
              >
                {EMPLOYEE_SEARCH_FIELDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Search operator"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchOperator}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    searchOperator: event.target.value as EmployeeFilterState["searchOperator"],
                  }));
                  setPage(1);
                }}
              >
                {searchOperatorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search employees..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</span>
            {branchFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.branch === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, branch: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</span>
            {activeFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.active === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, active: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</span>
            {departmentFilters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filters.department === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, department: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSaving}
                onClick={() =>
                  setDeleteTarget(employees.filter((employee) => selectedIds.includes(String(employee.id))))
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading employees…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={employees}
            rowKey={(employee) => String(employee.id)}
            rowLabel={(employee) => employee.name}
            columnLayout={columnVisibility}
            minWidth={2400}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewEmployee}
            emptyState={
              <>
                <p className="text-muted-foreground">No employees match your search or filters.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add employee
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isFetching ? "Refreshing…" : `Showing ${employees.length} of ${totalEmployees} employees`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <EmployeeViewSheet
        employee={viewEmployee}
        open={Boolean(viewEmployee)}
        onOpenChange={(open) => {
          if (!open) setViewEmployee(null);
        }}
        onEdit={openEditForm}
        onDelete={(employee) => {
          setViewEmployee(null);
          setDeleteTarget(employee);
        }}
      />

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              Fields match the EMSYS Employee API model: name, title, department, active, startDate, endDate,
              branch, address, contact, loans, cost, and linked user.
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            key={editingEmployee?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingEmployee
                ? employeeToFormValues(editingEmployee)
                : createEmptyEmployeeForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add employee"}
            isSubmitting={isSaving}
            onSubmit={saveEmployee}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete employee{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected employees.`
                : "This will permanently remove this employee. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
