"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeViewSheet } from "@/components/employees/employee-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { EMPLOYEE_TABLE_FILTER_FIELDS } from "@/lib/employees/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useTableSort } from "@/lib/table/use-table-sort";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPrimaryPhonesDisplayOrDash } from "@/lib/phones/phones";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
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
  buildEmployeeListParams,
  createEmptyEmployeeForm,
  employeeToFormValues,
  type Employee,
  type EmployeeFilterState,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_EMPLOYEE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: EmployeeFilterState = {
  query: "",
  rows: [],
};

export function EmployeesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<EmployeeFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_EMPLOYEE_LIST_PARAMS.sort, () => setPage(1));
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | Employee[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildEmployeeListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useEmployees(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "employees", baseHref: "/employees", mode: "add", label: "Add employee" });
      return;
    }
    setEditingEmployee(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(employee: Employee) {
    if (isDesktopTabs) {
      setViewEmployee(null);
      openFormTab({
        feature: "employees",
        baseHref: "/employees",
        mode: "edit",
        entityId: String(employee.id),
        label: `Edit ${employee.name}`,
      });
      return;
    }
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
    ...stats.branches.map((branch) => ({
      label: branch.label,
      value: stats.isLoading ? "…" : branch.total.toString(),
      description: `Employees in ${branch.label}`,
      icon: Building2,
    })),
  ];

  const branchFilterOptions = useMemo(() => {
    const apiBranches = branchesData?.items ?? [];

    return apiBranches.map((branch) => ({
      value: branch.code,
      label: formatBranchFilterLabel(branch),
    }));
  }, [branchesData?.items]);

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
        <TableTagText className={getEmployeeActiveBadgeClass(employee.active)}>
          {getEmployeeActiveLabel(employee.active)}
        </TableTagText>
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
      sortField: "branch.name",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (employee) => (
        <TableTagText className={getEmployeeBranchBadgeClass(employee)}>
          {formatEmployeeBranchLabel(employee)}
        </TableTagText>
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
      sortField: "phones.number",
      renderCell: (employee) => formatPrimaryPhonesDisplayOrDash(employee.phones),
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
      sortField: "user.userName",
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
      renderCell: (employee) => (employee.createdAt ? formatAuditDateTime(employee.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (employee) => (employee.updatedAt ? formatAuditDateTime(employee.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("employees", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, EMPLOYEE_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalEmployees,
    catalogTotal: stats.total,
    noun: "employees",
    isLoading: isFetching && employees.length === 0,
    catalogLoading: stats.isLoading,
  });

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

      <StatCards items={statCards} />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
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
                presets={{
                  storageKey: "employees",
                  rows: filters.rows,
                  fields: EMPLOYEE_TABLE_FILTER_FIELDS,
                  onApply: (rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  },
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={filters.rows}
                  fields={EMPLOYEE_TABLE_FILTER_FIELDS}
                  dynamicOptions={{
                    branches: branchesLoading ? [] : branchFilterOptions,
                  }}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={employees.map((employee) => String(employee.id))}
          totalCount={totalEmployees}
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
            sort={sort}
            onSortChange={onSortChange}
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
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
            externalError={formError}
            onSubmit={saveEmployee}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
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
