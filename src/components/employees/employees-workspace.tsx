"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeViewSheet } from "@/components/employees/employee-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
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
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import { getPrimaryPhoneNumber } from "@/lib/phones/phones";
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
  createEmployeeSearchFilter,
  createEmptyEmployeeForm,
  employeeToFormValues,
  type Employee,
  type EmployeeFilterState,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_EMPLOYEE_LIST_PARAMS.limit;

const defaultFilters: EmployeeFilterState = {
  query: "",
  branch: "all",
  active: "all",
  department: "all",
};

export function EmployeesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<EmployeeFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      const search = createEmployeeSearchFilter(deferredQuery);

      return {
        ...DEFAULT_EMPLOYEE_LIST_PARAMS,
        page,
        limit: PAGE_SIZE,
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
      label: "Employee ID",
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
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (employee) => (
        <UniformWidthPill columnKey="active">
          <Badge className={getEmployeeActiveBadgeClass(employee.active)}>
            {getEmployeeActiveLabel(employee.active)}
          </Badge>
        </UniformWidthPill>
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
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (employee) => (
        <UniformWidthPill columnKey="branch">
          <Badge className={getEmployeeBranchBadgeClass(employee)}>
            {formatEmployeeBranchLabel(employee)}
          </Badge>
        </UniformWidthPill>
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
      id: "phone",
      label: "Phone",
      renderCell: (employee) => formatPhoneDisplayOrDash(getPrimaryPhoneNumber(employee.phones)),
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
  ];

  const columnVisibility = useColumnVisibility("employees", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount =
    (filters.branch !== "all" ? 1 : 0) +
    (filters.active !== "all" ? 1 : 0) +
    (filters.department !== "all" ? 1 : 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    filters.branch !== "all" ||
    filters.active !== "all" ||
    filters.department !== "all";

  return (
    <div>
      <PageHeader
        title="Employees"
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add employee
          </Button>
        }
      />

      <StatCardsGrid>
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
      </StatCardsGrid>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search employees..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${employees.length} of ${totalEmployees} employees`}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
            <TableFilterSection label="Branch">
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
            </TableFilterSection>

            <TableFilterSection label="Active">
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
            </TableFilterSection>

            <TableFilterSection label="Department">
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
            </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={employees.map((employee) => String(employee.id))}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const employee = employees.find((entry) => String(entry.id) === selectedIds[0]);
            if (employee) openEditForm(employee);
          }}
          onDelete={() =>
            setDeleteTarget(employees.filter((employee) => selectedIds.includes(String(employee.id))))
          }
          deleteDisabled={isSaving}
        />

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading employees…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={employees}
            page={currentPage}
            isPageDataPending={isFetching}
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
            onRowDoubleClick={openEditForm}
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
