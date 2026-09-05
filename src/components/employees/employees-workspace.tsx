"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Users,
} from "lucide-react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeMobileList } from "@/components/employees/employee-mobile-list";
import { EmployeeViewSheet } from "@/components/employees/employee-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
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
import { useTranslation } from "@/lib/i18n";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { formatPaginatedListSummary, buildToolbarSearchSummary } from "@/lib/table/list-summary";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPrimaryPhonesDisplayOrDash } from "@/lib/phones/phones";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatEmployeeDate,
  formatEmployeeId,
  formatEmployeeMoney,
  formatEmployeeUserLabel,
  getEmployeeActiveBadgeClass,
  getEmployeeBranchBadgeClass,
} from "@/lib/employees/display";
import { useEmployeeFilterFields } from "@/lib/employees/hooks/use-employee-filter-fields";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
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
  areEmployeeFormValuesEquivalent,
} from "@/lib/employees/types";
import type { DataTableColumn } from "@/lib/table/types";

const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: EmployeeFilterState = {
  query: "",
  rows: [],
};

export function EmployeesWorkspace() {
  const { t } = useTranslation();
  const employeeLabels = useEmployeeLabels();
  const employeeFilterFields = useEmployeeFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const [filters, setFilters] = useState<EmployeeFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
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
        limit: pageLimit,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useEmployees(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
  const stats = useEmployeeStats();
  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deleteEmployeesMutation = useDeleteEmployees();

  const employees = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalEmployees = data?.total ?? 0;
  rememberTotal(totalEmployees);
  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    employees.length > 0 && employees.every((employee) => selectedIds.includes(String(employee.id)));
  const isSaving =
    createEmployeeMutation.isPending ||
    updateEmployeeMutation.isPending ||
    deleteEmployeesMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

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
      openFormTab({ feature: "employees", baseHref: "/employees", mode: "add", label: t("employees.actions.add") });
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
        label: t("employees.actions.editNamed", { name: employee.name }),
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
        if (areEmployeeFormValuesEquivalent(values, employeeToFormValues(editingEmployee))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingEmployee(null);
          return;
        }

        const nextEmployee = await updateEmployeeMutation.mutateAsync({
          employeeId: String(editingEmployee.id),
          values,
        });
        notifyUpdated(t("employees.entity"), nextEmployee.name);
      } else {
        const nextEmployee = await createEmployeeMutation.mutateAsync(values);
        notifyAdded(t("employees.entity"), nextEmployee.name);
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
      notifyDeleted(t("employees.entity"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: t("employees.stats.total.label"),
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: t("employees.stats.total.description"),
      icon: Users,
    },
    ...stats.branches.map((branch) => ({
      label: t(`employees.enums.branch.${branch.portal}`),
      value: stats.isLoading ? "…" : branch.total.toString(),
      description: t("employees.stats.branch.description", {
        branch: t(`employees.enums.branch.${branch.portal}`),
      }),
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

  const dash = t("common.empty.dash");

  const tableColumns: DataTableColumn<Employee>[] = useMemo(
    () => [
      {
        id: "id",
        label: t("employees.columns.id"),
        cellClassName: "font-mono text-xs",
        renderCell: (employee) => formatEmployeeId(employee.id),
      },
      {
        id: "name",
        label: t("employees.columns.name"),
        cellClassName: "font-medium",
        renderCell: (employee) => employee.name,
      },
      {
        id: "title",
        label: t("employees.columns.title"),
        renderCell: (employee) => employeeLabels.title(employee.title) || dash,
      },
      {
        id: "department",
        label: t("employees.columns.department"),
        renderCell: (employee) => employeeLabels.department(employee.department) || dash,
      },
      {
        id: "active",
        label: t("employees.columns.active"),
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (employee) => (
          <TableTagText className={getEmployeeActiveBadgeClass(employee.active)}>
            {employeeLabels.active(employee.active)}
          </TableTagText>
        ),
      },
      {
        id: "startDate",
        label: t("employees.columns.startDate"),
        cellClassName: "text-muted-foreground",
        renderCell: (employee) => (employee.startDate ? formatAuditDate(employee.startDate) : dash),
      },
      {
        id: "endDate",
        label: t("employees.columns.endDate"),
        cellClassName: "text-muted-foreground",
        renderCell: (employee) => (employee.endDate ? formatAuditDate(employee.endDate) : dash),
      },
      {
        id: "branch",
        label: t("employees.columns.branch"),
        sortField: "branch.name",
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (employee) => (
          <TableTagText className={getEmployeeBranchBadgeClass(employee)}>
            {employeeLabels.branchLabel(employee)}
          </TableTagText>
        ),
      },
      {
        id: "branch.code",
        label: t("employees.columns.branch.code"),
        renderCell: (employee) => employee.branch.code || dash,
      },
      {
        id: "branch.name",
        label: t("employees.columns.branch.name"),
        renderCell: (employee) => employee.branch.name || dash,
      },
      {
        id: "phone",
        label: t("employees.columns.phone"),
        sortField: "phones.number",
        renderCell: (employee) => formatPrimaryPhonesDisplayOrDash(employee.phones),
      },
      {
        id: "email",
        label: t("employees.columns.email"),
        renderCell: (employee) => employee.email || dash,
      },
      {
        id: "address.address1",
        label: t("employees.columns.address.address1"),
        renderCell: (employee) => employee.address.address1 || dash,
      },
      {
        id: "address.city",
        label: t("employees.columns.address.city"),
        renderCell: (employee) => employee.address.city || dash,
      },
      {
        id: "address.state",
        label: t("employees.columns.address.state"),
        renderCell: (employee) => employee.address.state || dash,
      },
      {
        id: "address.country",
        label: t("employees.columns.address.country"),
        renderCell: (employee) => employee.address.country || dash,
      },
      {
        id: "cost",
        label: t("employees.columns.cost"),
        renderCell: (employee) => formatEmployeeMoney(employee.cost),
      },
      {
        id: "totalLoanGiven",
        label: t("employees.columns.totalLoanGiven"),
        renderCell: (employee) => formatEmployeeMoney(employee.totalLoanGiven),
      },
      {
        id: "totalPaymentReceived",
        label: t("employees.columns.totalPaymentReceived"),
        renderCell: (employee) => formatEmployeeMoney(employee.totalPaymentReceived),
      },
      {
        id: "loanAmountOwed",
        label: t("employees.columns.loanAmountOwed"),
        renderCell: (employee) => formatEmployeeMoney(employee.loanAmountOwed),
      },
      {
        id: "loanBalanceUpdated",
        label: t("employees.columns.loanBalanceUpdated"),
        renderCell: (employee) =>
          employee.loanBalanceUpdated ? formatEmployeeDate(employee.loanBalanceUpdated) : dash,
      },
      {
        id: "user",
        label: t("employees.columns.user"),
        sortField: "user.name",
        renderCell: (employee) => formatEmployeeUserLabel(employee),
      },
      {
        id: "user.id",
        label: t("employees.columns.user.id"),
        cellClassName: "font-mono text-xs",
        renderCell: (employee) => (employee.user?.id ? String(employee.user.id) : dash),
      },
      {
        id: "user.name",
        label: t("employees.columns.user.name"),
        renderCell: (employee) => employee.user?.name || dash,
      },
      {
        id: "createdAt",
        label: t("employees.columns.createdAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (employee) => (employee.createdAt ? formatAuditDateTime(employee.createdAt) : dash),
      },
      {
        id: "updatedAt",
        label: t("employees.columns.updatedAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (employee) => (employee.updatedAt ? formatAuditDateTime(employee.updatedAt) : dash),
      },
    ],
    [dash, employeeLabels, t],
  );

  const columnVisibility = useColumnVisibility("employees", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, employeeFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalEmployees,
      catalogTotal: stats.total,
      noun: t("employees.noun"),
      isLoading: isFetching && employees.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: employees.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalEmployees,
      noun: t("employees.noun"),
      isFiltered: hasActiveFilters,
      isLoading: isFetching,
    },
    t,
  );

  return (
    <div>
      <div className="hidden md:block">
        <PageHeader
          title={t("employees.title")}
          description={t("employees.pages.description")}
          actions={
            <Button onClick={openAddForm} disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {t("employees.actions.add")}
            </Button>
          }
        />
      </div>

      <StatCards className="hidden md:block" items={statCards} />

      <EmployeeMobileList
        employees={employees}
        title={t("employees.title")}
        listSummary={listSummary}
        totalCount={totalEmployees}
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoading}
        isSaving={isSaving}
        showInitialLoading={isLoading && employees.length === 0}
        listErrorMessage={listErrorMessage}
        filters={filters}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        employeeFilterFields={employeeFilterFields}
        branchFilterOptions={branchFilterOptions}
        branchesLoading={branchesLoading}
        selectedIds={selectedIds}
        onAdd={openAddForm}
        onSearchChange={(query) => {
          setFilters((current) => ({ ...current, query }));
          setPage(1);
        }}
        onFiltersOpenChange={setFiltersOpen}
        onFilterRowsChange={(rows) => {
          setFilters((current) => ({ ...current, rows }));
          setPage(1);
        }}
        onClearFilters={() => {
          setFilters(defaultFilters);
          setPage(1);
        }}
        onPageChange={setPage}
        onToggleSelect={toggleSelect}
        onClearSelection={() => setSelectedIds([])}
        onView={setViewEmployee}
        onEdit={openEditForm}
        onDeleteSelected={() =>
          setDeleteTarget(employees.filter((employee) => selectedIds.includes(String(employee.id))))
        }
      />

      <Card className="mt-6 hidden gap-0 md:flex">
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
                placeholder={t("employees.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "employees",
                  rows: filters.rows,
                  fields: employeeFilterFields,
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
                  fields={employeeFilterFields}
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
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {t("employees.loading.employees")}
          </div>
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
            activeRowId={viewEmployee ? String(viewEmployee.id) : undefined}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("employees.empty.noMatch") : t("employees.empty.noneYet")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("employees.actions.add")}
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl max-md:inset-0 max-md:h-[100dvh] max-md:max-h-none max-md:w-screen max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 max-md:border-primary/70 max-md:bg-primary max-md:py-6">
            <DialogTitle className="max-md:text-3xl max-md:font-bold max-md:text-primary-foreground">
              {formMode === "edit" ? t("employees.form.editTitle") : t("employees.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm
            key={editingEmployee?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingEmployee
                ? employeeToFormValues(editingEmployee)
                : createEmptyEmployeeForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("employees.actions.add")}
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
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("employees.dialogs.deleteTitlePlural")
                : t("employees.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("employees.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("employees.dialogs.deleteOne", {
                    name:
                      !Array.isArray(deleteTarget) && deleteTarget?.name
                        ? deleteTarget.name
                        : t("employees.dialogs.unnamed"),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
