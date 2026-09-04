"use client";

import type { ComponentProps } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
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
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableFilterPanel } from "@/components/app-shell/table-directory-toolbar";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Button } from "@/components/ui/button";
import {
  ADDRESS_TEXT_WRAP_CLASSNAME,
  formatAddressLine,
  getPrimaryAddress,
} from "@/lib/customers/utils/address-utils";
import {
  formatAccountBalance,
  getClientTypeBadgeClass,
} from "@/lib/customers/display";
import {
  getCustomerClientType,
  type Customer,
  type CustomerFilterState,
} from "@/lib/customers/types";
import { isCustomerReceiverType } from "@/lib/customers/customer-type";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FilterField = ComponentProps<typeof TableAdvancedFilterBuilder>["fields"][number];
type FilterOption = { value: string; label: string };

type CustomerMobileListProps = {
  customers: Customer[];
  title: string;
  listSummary: string;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  isSaving: boolean;
  showInitialLoading: boolean;
  listErrorMessage: string | null;
  filters: CustomerFilterState;
  filtersOpen: boolean;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  customerFilterFields: FilterField[];
  branchFilterOptions: FilterOption[];
  customerTypeFilterOptions: FilterOption[];
  branchesLoading: boolean;
  selectedIds: string[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onAdd: () => void;
  onSearchChange: (query: string) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onFilterRowsChange: (rows: CustomerFilterState["rows"]) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onToggleSelect: (customerId: string, checked: boolean) => void;
  onClearSelection: () => void;
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDeleteSelected: () => void;
};

function getCustomerInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function getMobileCustomerTypeLabel(customer: Customer, t: ReturnType<typeof useTranslation>["t"]) {
  return isCustomerReceiverType(customer.customerType)
    ? t("customers.types.receiver")
    : t("customers.types.sender");
}

function getMobileCustomerAddress(customer: Customer, fallback: string): string {
  const address = getPrimaryAddress(customer);
  return address ? formatAddressLine(address, "full") : fallback;
}

function CustomerMobileRow({
  customer,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
}: {
  customer: Customer;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const clientType = getCustomerClientType(customer) ?? "sender";
  const phone = getPrimaryPhoneDisplayNumber(customer.phones) || t("common.empty.dash");
  const address = getMobileCustomerAddress(customer, t("common.empty.dash"));

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
          aria-label={customer.name}
        >
          {selected ? <Check className="size-6" /> : getCustomerInitials(customer.name)}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground">
                {customer.name}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {customer.IDNumber || t("common.empty.dash")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-foreground">
                {formatAccountBalance(customer.accountBalance)}
              </p>
              <TableTagText className={cn("mt-1 inline-flex", getClientTypeBadgeClass(clientType))}>
                {getMobileCustomerTypeLabel(customer, t)}
              </TableTagText>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <Phone className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{phone}</span>
            </p>
            <p className="flex min-w-0 items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className={ADDRESS_TEXT_WRAP_CLASSNAME}>{address}</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CustomerMobileList({
  customers,
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
  customerFilterFields,
  branchFilterOptions,
  customerTypeFilterOptions,
  branchesLoading,
  selectedIds,
  canCreate,
  canUpdate,
  canDelete,
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
}: CustomerMobileListProps) {
  const { t } = useTranslation();
  const selectedCustomers = customers.filter((customer) => selectedIds.includes(customer.id));
  const singleSelectedCustomer = selectedIds.length === 1 ? selectedCustomers[0] : undefined;

  return (
    <section className="mt-6 space-y-5 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-4xl font-bold tracking-normal text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{listSummary}</p>
        </div>
        {canCreate ? (
          <Button
            size="icon"
            className="size-12 shrink-0 rounded-2xl shadow-sm"
            onClick={onAdd}
            disabled={isSaving}
            aria-label={t("customers.actions.add")}
          >
            <Plus className="size-6" />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <TableSearchInput
            value={filters.query}
            onChange={onSearchChange}
            placeholder={t("customers.search.placeholder")}
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
            storageKey: "customers",
            rows: filters.rows,
            fields: customerFilterFields,
            onApply: onFilterRowsChange,
          }}
          onClearAll={hasActiveFilters ? onClearFilters : undefined}
        >
          <TableAdvancedFilterBuilder
            open={filtersOpen}
            rows={filters.rows}
            fields={customerFilterFields}
            dynamicOptions={{
              branches: branchesLoading ? [] : branchFilterOptions,
              customerTypes: customerTypeFilterOptions,
            }}
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
            {singleSelectedCustomer ? (
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => onView(singleSelectedCustomer)}
                aria-label={t("common.actions.view")}
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
            {canUpdate && singleSelectedCustomer ? (
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => onEdit(singleSelectedCustomer)}
                aria-label={t("common.actions.edit")}
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
            {canDelete ? (
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
            ) : null}
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
          title={t("customers.loading.title")}
          description={t("customers.loading.description")}
          columns={t("customers.loading.columns").split(", ")}
        />
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <p className="text-muted-foreground">{t("customers.empty.noMatch")}</p>
          {canCreate ? (
            <Button className="mt-4 rounded-2xl" onClick={onAdd}>
              <Plus className="size-4" />
              {t("customers.actions.add")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {customers.map((customer) => {
            const selected = selectedIds.includes(customer.id);

            return (
              <CustomerMobileRow
                key={customer.id}
                customer={customer}
                selected={selected}
                selectionMode={selectedIds.length > 0}
                onToggleSelect={() => onToggleSelect(customer.id, !selected)}
                onOpen={() => onView(customer)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
