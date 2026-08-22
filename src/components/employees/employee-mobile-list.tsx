"use client";

import type { ComponentProps } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Users,
} from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { EmployeeMobileRow } from "@/components/employees/employee-mobile-row";
import { EmployeeMobileSelectionToolbar } from "@/components/employees/employee-mobile-selection-toolbar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableFilterPanel } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { Button } from "@/components/ui/button";
import type { Employee, EmployeeFilterState } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";

type FilterField = ComponentProps<typeof TableAdvancedFilterBuilder>["fields"][number];
type FilterOption = { value: string; label: string };

type EmployeeMobileListProps = {
  employees: Employee[];
  title: string;
  listSummary: string;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  isSaving: boolean;
  showInitialLoading: boolean;
  listErrorMessage: string | null;
  filters: EmployeeFilterState;
  filtersOpen: boolean;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  employeeFilterFields: FilterField[];
  branchFilterOptions: FilterOption[];
  branchesLoading: boolean;
  selectedIds: string[];
  onAdd: () => void;
  onSearchChange: (query: string) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onFilterRowsChange: (rows: EmployeeFilterState["rows"]) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onToggleSelect: (employeeId: string, checked: boolean) => void;
  onClearSelection: () => void;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDeleteSelected: () => void;
};

export function EmployeeMobileList({
  employees,
  title,
  listSummary,
  totalCount,
  currentPage,
  totalPages,
  isLoading,
  isSaving,
  showInitialLoading,
  listErrorMessage,
  filters,
  filtersOpen,
  activeFilterCount,
  hasActiveFilters,
  employeeFilterFields,
  branchFilterOptions,
  branchesLoading,
  selectedIds,
  onAdd,
  onSearchChange,
  onFiltersOpenChange,
  onFilterRowsChange,
  onClearFilters,
  onPageChange,
  onToggleSelect,
  onClearSelection,
  onView,
  onEdit,
  onDeleteSelected,
}: EmployeeMobileListProps) {
  const { t } = useTranslation();
  const selectedEmployees = employees.filter((employee) =>
    selectedIds.includes(String(employee.id)),
  );
  const singleSelectedEmployee = selectedIds.length === 1 ? selectedEmployees[0] : undefined;

  return (
    <section className="mt-6 space-y-5 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-4xl font-bold tracking-normal text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{listSummary}</p>
        </div>
        <Button
          size="icon"
          className="size-12 shrink-0 rounded-2xl shadow-sm"
          onClick={onAdd}
          disabled={isSaving}
          aria-label={t("employees.actions.add")}
        >
          <Plus className="size-6" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <TableSearchInput
            value={filters.query}
            onChange={onSearchChange}
            placeholder={t("employees.search.placeholder")}
          />
        </div>
        <Button
          type="button"
          variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
          size="icon"
          className="size-12 shrink-0 rounded-2xl"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
          aria-label={t("common.table.filter")}
        >
          <Filter className="size-5" />
        </Button>
      </div>

      {filtersOpen ? (
        <TableFilterPanel
          resultSummary={listSummary}
          presets={{
            storageKey: "employees",
            rows: filters.rows,
            fields: employeeFilterFields,
            onApply: onFilterRowsChange,
          }}
          onClearAll={hasActiveFilters ? onClearFilters : undefined}
        >
          <TableAdvancedFilterBuilder
            open={filtersOpen}
            rows={filters.rows}
            fields={employeeFilterFields}
            dynamicOptions={{ branches: branchesLoading ? [] : branchFilterOptions }}
            onChange={onFilterRowsChange}
          />
        </TableFilterPanel>
      ) : null}

      <EmployeeMobileSelectionToolbar
        selectedIds={selectedIds}
        totalCount={totalCount}
        singleSelectedEmployee={singleSelectedEmployee}
        isSaving={isSaving}
        onClearSelection={onClearSelection}
        onView={onView}
        onEdit={onEdit}
        onDeleteSelected={onDeleteSelected}
      />

      {!showInitialLoading ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-12 rounded-2xl px-4"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="size-4" />
            {t("common.actions.previous")}
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-12 rounded-2xl px-4"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            {t("common.actions.next")}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {listErrorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {listErrorMessage}
        </div>
      ) : null}

      {showInitialLoading ? (
        <DirectoryTableLoader
          icon={Users}
          title={t("employees.loading.employees")}
          description={listSummary}
          columns={[
            t("employees.columns.name"),
            t("employees.columns.title"),
            t("employees.columns.phone"),
          ]}
        />
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters ? t("employees.empty.noMatch") : t("employees.empty.noneYet")}
          </p>
          <Button className="mt-4 rounded-2xl" onClick={onAdd}>
            <Plus className="size-4" />
            {t("employees.actions.add")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {employees.map((employee) => {
            const employeeId = String(employee.id);
            const selected = selectedIds.includes(employeeId);

            return (
              <EmployeeMobileRow
                key={employeeId}
                employee={employee}
                selected={selected}
                selectionMode={selectedIds.length > 0}
                onToggleSelect={() => onToggleSelect(employeeId, !selected)}
                onOpen={() => onView(employee)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
