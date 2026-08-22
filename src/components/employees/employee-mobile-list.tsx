"use client";

import type { ComponentProps } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
  Users,
} from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableFilterPanel } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Button } from "@/components/ui/button";
import { formatPrimaryPhonesDisplayOrDash } from "@/lib/phones/phones";
import {
  formatEmployeeAddress,
  getEmployeeActiveBadgeClass,
  getEmployeeBranchBadgeClass,
} from "@/lib/employees/display";
import type { Employee, EmployeeFilterState } from "@/lib/employees/types";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

function getEmployeeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function EmployeeMobileRow({
  employee,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
}: {
  employee: Employee;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const employeeLabels = useEmployeeLabels();
  const phone = formatPrimaryPhonesDisplayOrDash(employee.phones);
  const address = formatEmployeeAddress(employee);

  function activateRow() {
    if (selectionMode) {
      onToggleSelect();
      return;
    }
    onOpen();
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={cn(
        "border-b p-4 text-left outline-none transition-colors last:border-b-0",
        selected && "bg-primary/5",
      )}
      onClick={activateRow}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateRow();
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-2xl border text-sm font-bold transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect();
          }}
          aria-pressed={selected}
          aria-label={employee.name}
        >
          {selected ? <Check className="size-6" /> : getEmployeeInitials(employee.name)}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground">
                {employee.name}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[employeeLabels.title(employee.title), employeeLabels.department(employee.department)]
                  .filter(Boolean)
                  .join(" · ") || t("common.empty.dash")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <TableTagText className={getEmployeeActiveBadgeClass(employee.active)}>
                {employeeLabels.active(employee.active)}
              </TableTagText>
              <TableTagText className={getEmployeeBranchBadgeClass(employee)}>
                {employeeLabels.branchLabel(employee)}
              </TableTagText>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <Phone className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{phone}</span>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{employee.email || t("common.empty.dash")}</span>
            </p>
            <p className="flex min-w-0 items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 whitespace-normal break-words [overflow-wrap:break-word]">
                {address}
              </span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

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

      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-sm">
          <p className="min-w-0 text-lg font-bold">
            {t("common.table.selected", { count: selectedIds.length, total: totalCount })}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              <X className="size-4" />
              {t("common.table.clearAll")}
            </Button>
            {singleSelectedEmployee ? (
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => onView(singleSelectedEmployee)}
                aria-label={t("common.actions.view")}
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
            {singleSelectedEmployee ? (
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => onEdit(singleSelectedEmployee)}
                aria-label={t("common.actions.edit")}
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeleteSelected}
              disabled={isSaving}
              aria-label={t("common.actions.delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

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
