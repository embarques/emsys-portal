"use client";

import { useMemo, useState } from "react";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeEmployeeKpis,
  formatEmployeeAddress,
  formatEmployeeDate,
  getEmployeeBranchBadgeClass,
  getEmployeeBranchLabel,
  getEmployeeStatusBadgeClass,
  getEmployeeStatusLabel,
  truncateEmployeeId,
  employeeMatchesQuery,
} from "@/lib/employees/display";
import { cloneEmployees } from "@/lib/employees/mock-data";
import {
  EMPLOYEE_BRANCHES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_STATUSES,
  createEmptyEmployeeForm,
  employeeToFormValues,
  formValuesToEmployee,
  type Employee,
  type EmployeeFilterState,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: EmployeeFilterState = {
  query: "",
  branch: "all",
  status: "all",
  department: "all",
};

export function EmployeesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [employees, setEmployees] = useState<Employee[]>(() => cloneEmployees());
  const [filters, setFilters] = useState<EmployeeFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | Employee[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (!employeeMatchesQuery(employee, filters.query)) return false;
      if (filters.branch !== "all" && employee.branch !== filters.branch) return false;
      if (filters.status !== "all" && employee.status !== filters.status) return false;
      if (filters.department !== "all" && employee.department !== filters.department) return false;
      return true;
    });
  }, [employees, filters]);

  const kpis = useMemo(() => computeEmployeeKpis(employees), [employees]);
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageEmployees.length > 0 && pageEmployees.every((employee) => selectedIds.includes(employee.employeeId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageEmployees.map((employee) => employee.employeeId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageEmployees.some((employee) => employee.employeeId === id))
    );
  }

  function toggleSelect(employeeId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, employeeId] : current.filter((entry) => entry !== employeeId)
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

  function saveEmployee(values: EmployeeFormValues) {
    try {
      if (formMode === "edit" && editingEmployee) {
        const nextEmployee = formValuesToEmployee(
          { ...values, createdBy: editingEmployee.createdBy },
          editingEmployee.createdAt,
          editingEmployee.createdBy,
          new Date().toISOString()
        );
        setEmployees((current) =>
          current.map((employee) =>
            employee.employeeId === editingEmployee.employeeId ? nextEmployee : employee
          )
        );
        notifyUpdated("Employee", nextEmployee.name);
      } else {
        const nextEmployee = formValuesToEmployee(values);
        setEmployees((current) => [nextEmployee, ...current]);
        notifyAdded("Employee", nextEmployee.name);
      }

      setFormMode(null);
      setEditingEmployee(null);
      setFormError(null);
      setPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save employee.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((employee) => employee.employeeId)
      : [deleteTarget.employeeId];
    setEmployees((current) => current.filter((employee) => !ids.includes(employee.employeeId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewEmployee(null);
    notifyDeleted("Employee", ids.length);
  }

  const stats = [
    { label: "Total employees", value: kpis.total.toString(), description: "Employees on record", icon: Users },
    { label: "Active", value: kpis.active.toString(), description: "Currently active", icon: UserRound },
    { label: "Inactive", value: kpis.inactive.toString(), description: "No longer active", icon: UserRound },
  ];

  const branchFilters: { value: EmployeeFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All branches" },
    ...EMPLOYEE_BRANCHES,
  ];

  const statusFilters: { value: EmployeeFilterState["status"]; label: string }[] = [
    { value: "all", label: "All statuses" },
    ...EMPLOYEE_STATUSES,
  ];

  const departmentFilters = [
    { value: "all", label: "All departments" },
    ...EMPLOYEE_DEPARTMENTS.map((department) => ({ value: department, label: department })),
  ];

  const tableColumns: DataTableColumn<Employee>[] = [
    {
      id: "employeeId",
      label: "ID",
      cellClassName: "font-mono text-xs",
      renderCell: (employee) => truncateEmployeeId(employee.employeeId),
    },
    {
      id: "name",
      label: "Name",
      cellClassName: "font-medium",
      renderCell: (employee) => employee.name,
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (employee) => (
        <Badge className={getEmployeeBranchBadgeClass(employee.branch)}>
          {getEmployeeBranchLabel(employee.branch)}
        </Badge>
      ),
    },
    {
      id: "department",
      label: "Department",
      renderCell: (employee) => employee.department,
    },
    {
      id: "role",
      label: "Role",
      renderCell: (employee) => employee.role,
    },
    {
      id: "address",
      label: "Address",
      renderCell: (employee) => employee.address || "—",
    },
    {
      id: "city",
      label: "City",
      renderCell: (employee) => employee.city || "—",
    },
    {
      id: "state",
      label: "State",
      renderCell: (employee) => employee.state || "—",
    },
    {
      id: "zip",
      label: "Zip",
      renderCell: (employee) => employee.zip || "—",
    },
    {
      id: "phone",
      label: "Phone",
      renderCell: (employee) => employee.phone || "—",
    },
    {
      id: "email",
      label: "Email",
      renderCell: (employee) => employee.email || "—",
    },
    {
      id: "startDate",
      label: "Started",
      renderCell: (employee) => formatEmployeeDate(employee.startDate),
    },
    {
      id: "endDate",
      label: "Ended",
      renderCell: (employee) => (employee.endDate ? formatEmployeeDate(employee.endDate) : "—"),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (employee) => (
        <Badge className={getEmployeeStatusBadgeClass(employee.status)}>
          {getEmployeeStatusLabel(employee.status)}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => formatAuditDate(employee.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (employee) => employee.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => formatAuditDate(employee.updatedAt),
    },
    {
      id: "fullAddress",
      label: "Full address",
      renderCell: (employee) => formatEmployeeAddress(employee),
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

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee records with branch, department, role, contact info, and employment dates."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add employee
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
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
              <CardDescription>Search and filter employees by branch, department, and status.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md lg:justify-end">
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
                key={option.value}
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            {statusFilters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filters.status === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, status: option.value }));
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
                onClick={() =>
                  setDeleteTarget(employees.filter((employee) => selectedIds.includes(employee.employeeId)))
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageEmployees}
          rowKey={(employee) => employee.employeeId}
          rowLabel={(employee) => employee.name}
          columnLayout={columnVisibility}
          minWidth={1800}
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

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageEmployees.length} of {filteredEmployees.length} employees
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
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
              disabled={currentPage >= totalPages}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              Record branch, department, role, contact details, and employment dates.
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            key={editingEmployee?.employeeId ?? "new"}
            initialValues={
              formMode === "edit" && editingEmployee
                ? employeeToFormValues(editingEmployee)
                : createEmptyEmployeeForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingEmployee?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add employee"}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
