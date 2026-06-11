"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerViewSheet } from "@/components/customers/customer-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
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
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { CUSTOMER_TABLE_FILTER_FIELDS } from "@/lib/customers/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { formatFilteredCountSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import { getPrimaryPhoneNumber } from "@/lib/phones/phones";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatAccountBalance,
  formatCustomerBranchLabel,
  getClientTypeBadgeClass,
  getCustomerBranchBadgeClass,
  getCustomerTypeLabel,
  truncateCustomerId,
} from "@/lib/customers/display";
import {
  useCreateCustomer,
  useCustomerStats,
  useCustomers,
  useDeleteCustomers,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  buildCustomerListParams,
  createEmptyCustomerForm,
  customerToFormValues,
  CUSTOMER_TYPE_OPTIONS,
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  getCustomerClientType,
  type Customer,
  type CustomerFilterState,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_CUSTOMER_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: CustomerFilterState = {
  query: "",
  rows: [],
};

type CustomerDeleteTarget =
  | { mode: "single"; customer: Customer }
  | { mode: "bulk"; ids: string[] };

export function CustomersWorkspace() {
  const { hasPermission } = useAuth();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const canCreateCustomers = hasPermission(
    PERMISSIONS.clientsCreate.name,
    PERMISSIONS.clientsCreate.resourceType,
  );
  const canUpdateCustomers = hasPermission(
    PERMISSIONS.clientsUpdate.name,
    PERMISSIONS.clientsUpdate.resourceType,
  );
  const canDeleteCustomers = hasPermission(
    PERMISSIONS.clientsDelete.name,
    PERMISSIONS.clientsDelete.resourceType,
  );
  const [filters, setFilters] = useState<CustomerFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerDeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function openDeleteTarget(target: CustomerDeleteTarget) {
    setDeleteError(null);
    setDeleteTarget(target);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  const listParams = useMemo(
    () =>
      buildCustomerListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
      }),
    [debouncedQuery, filters.rows, page],
  );

  const { data, isLoading, isError, error, isFetching, isPending } = useCustomers(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
  const stats = useCustomerStats();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomersMutation = useDeleteCustomers();

  const customers = data?.items ?? [];
  const totalCustomers = data?.total ?? 0;
  const showInitialTableLoading = isPending && customers.length === 0;
  const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    customers.length > 0 && customers.every((customer) => selectedIds.includes(customer.id));
  const isSaving =
    createCustomerMutation.isPending ||
    updateCustomerMutation.isPending ||
    deleteCustomersMutation.isPending;

  function openAddForm() {
    setEditingCustomer(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setFormMode("edit");
    setViewCustomer(null);
    setFormError(null);
  }

  async function saveCustomer(values: CustomerFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingCustomer) {
        const nextCustomer = await updateCustomerMutation.mutateAsync({
          customerId: editingCustomer.id,
          values,
        });
        notifyUpdated("Customer", nextCustomer.name);
      } else {
        const nextCustomer = await createCustomerMutation.mutateAsync(values);
        notifyAdded("Customer", nextCustomer.name);
      }

      setFormMode(null);
      setEditingCustomer(null);
      setPage(1);
    } catch (mutationError) {
      const { message, status } = normalizeApiError(mutationError);
      const detail =
        status === 403
          ? formMode === "edit"
            ? `${message} Ask an admin to enable customer update (canUpdateCustomer) on your role.`
            : `${message} Ask an admin to enable customer create (canCreateCustomer) on your role.`
          : message;
      setFormError(detail);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = deleteTarget.mode === "bulk" ? deleteTarget.ids : [deleteTarget.customer.id];

    try {
      await deleteCustomersMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      closeDeleteDialog();
      setViewCustomer(null);

      if (deleteTarget.mode === "single") {
        notifySuccess(`Customer "${deleteTarget.customer.name}" was deleted.`);
      } else {
        notifyDeleted("Customer", ids.length);
      }
    } catch (mutationError) {
      const { message, status } = normalizeApiError(mutationError);
      const detail =
        status === 403
          ? `${message} Ask an admin to enable customer delete (canDeleteCustomer) on your role.`
          : message;
      setDeleteError(detail);
      notifyError(detail);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...customers.map((customer) => customer.id)])),
      );
      return;
    }

    setSelectedIds((current) => current.filter((id) => !customers.some((customer) => customer.id === id)));
  }

  function toggleSelect(customerId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, customerId] : current.filter((entry) => entry !== customerId),
    );
  }

  const statCards = [
    {
      label: "Total customers",
      value: stats.total,
      description: "All customer records",
      icon: Users,
    },
    {
      label: "Senders",
      value: stats.senders,
      description: "Customers who send shipments",
      icon: Search,
    },
    {
      label: "Receivers",
      value: stats.receivers,
      description: "Customers who receive shipments",
      icon: UserCheck,
    },
  ];

  const branchFilterOptions = useMemo(() => {
    return (branchesData?.items ?? []).map((branch) => ({
      value: String(branch.id),
      label: formatBranchFilterLabel(branch),
    }));
  }, [branchesData?.items]);

  const customerTypeFilterOptions = useMemo(() => {
    return CUSTOMER_TYPE_OPTIONS.map((option) => {
      const count =
        option.value === CUSTOMER_TYPE_SENDER
          ? stats.senders
          : option.value === CUSTOMER_TYPE_RECEIVER
            ? stats.receivers
            : 0;

      return {
        value: String(option.value),
        label: stats.isLoading ? option.label : `${option.label} (${count.toLocaleString()})`,
      };
    });
  }, [stats.isLoading, stats.receivers, stats.senders]);

  const tableColumns: DataTableColumn<Customer>[] = [
    {
      id: "customerType",
      label: "customerType",
      renderCell: (customer) => {
        const clientType = getCustomerClientType(customer) ?? "sender";
        return (
          <Badge className={getClientTypeBadgeClass(clientType)}>{getCustomerTypeLabel(customer)}</Badge>
        );
      },
    },
    {
      id: "IDNumber",
      label: "IDNumber",
      renderCell: (customer) => customer.IDNumber || "—",
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (customer) => customer.name,
    },
    {
      id: "phone",
      label: "Phone",
      renderCell: (customer) => formatPhoneDisplayOrDash(getPrimaryPhoneNumber(customer.phones)),
    },
    {
      id: "address.address1",
      label: "address.address1",
      renderCell: (customer) => customer.address.address1 || "—",
    },
    {
      id: "address.address2",
      label: "address.address2",
      renderCell: (customer) => customer.address.address2 || "—",
    },
    {
      id: "address.city",
      label: "address.city",
      renderCell: (customer) => customer.address.city || "—",
    },
    {
      id: "address.state",
      label: "address.state",
      renderCell: (customer) => customer.address.state || "—",
    },
    {
      id: "address.zipcode",
      label: "address.zipcode",
      renderCell: (customer) => customer.address.zipcode || "—",
    },
    {
      id: "address.country",
      label: "address.country",
      renderCell: (customer) => customer.address.country || "—",
    },
    {
      id: "branch",
      label: "branch",
      renderCell: (customer) => (
        <Badge className={getCustomerBranchBadgeClass(customer)}>{formatCustomerBranchLabel(customer)}</Badge>
      ),
    },
    {
      id: "email",
      label: "email",
      renderCell: (customer) => customer.email || "—",
    },
    {
      id: "accountBalance",
      label: "accountBalance",
      renderCell: (customer) => formatAccountBalance(customer.accountBalance),
    },
    {
      id: "notes",
      label: "notes",
      cellClassName: "max-w-[240px] truncate",
      renderCell: (customer) => customer.notes || "—",
    },
    {
      id: "createdByID",
      label: "createdByID",
      renderCell: (customer) => (customer.createdByID != null ? String(customer.createdByID) : "—"),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (customer) => (customer.createdAt ? formatAuditDate(customer.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (customer) => (customer.updatedAt ? formatAuditDate(customer.updatedAt) : "—"),
    },
    {
      id: "oldID",
      label: "oldID",
      cellClassName: "font-mono text-xs",
      renderCell: (customer) => (customer.oldID > 0 ? String(customer.oldID) : "—"),
    },
    {
      id: "id",
      label: "Customer ID",
      cellClassName: "font-mono text-xs",
      renderCell: (customer) => truncateCustomerId(customer.id),
    },
  ];

  const isListFiltered =
    Boolean(debouncedQuery.trim()) || countCompleteFilterRows(filters.rows) > 0;

  const searchResultHint = filters.query.trim()
    ? isSearchPending
      ? "Searching customers…"
      : formatFilteredCountSummary({
          matched: totalCustomers,
          catalogTotal: stats.total,
          noun: "customers",
          isLoading: isFetching && customers.length === 0,
          catalogLoading: stats.isLoading,
        })
    : null;

  const listSummary = formatPaginatedListSummary({
    itemCountOnPage: customers.length,
    page: currentPage,
    pageSize: PAGE_SIZE,
    total: totalCustomers,
    noun: "customers",
    isFiltered: isListFiltered,
    isLoading: isFetching,
    catalogTotal: stats.total,
    catalogLoading: stats.isLoading,
  });

  const columnVisibility = useColumnVisibility("customers", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          canCreateCustomers ? (
            <Button onClick={openAddForm} disabled={isSaving}>
              <Plus className="h-4 w-4" />
              Add customer
            </Button>
          ) : null
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
                <div className="text-2xl font-bold">
                  {stats.isLoading ? "…" : stat.value.toLocaleString()}
                </div>
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
              <>
                <TableSearchInput
                  value={filters.query}
                  onChange={(query) => {
                    setFilters((current) => ({ ...current, query }));
                    setPage(1);
                  }}
                  placeholder="Search customers..."
                />
                {searchResultHint ? (
                  <p className="pl-1 text-xs text-muted-foreground" aria-live="polite">
                    {searchResultHint}
                  </p>
                ) : null}
              </>
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
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
                  fields={CUSTOMER_TABLE_FILTER_FIELDS}
                  dynamicOptions={{
                    branches: branchesLoading ? [] : branchFilterOptions,
                    customerTypes: customerTypeFilterOptions,
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

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={customers.map((customer) => customer.id)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const customer = customers.find((entry) => entry.id === selectedIds[0]);
            if (customer) openEditForm(customer);
          }}
          canEdit={canUpdateCustomers}
          onDelete={() => openDeleteTarget({ mode: "bulk", ids: [...selectedIds] })}
          canDelete={canDeleteCustomers}
          deleteDisabled={isSaving}
        />

        {showInitialTableLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading customers…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={customers}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(customer) => customer.id}
            rowLabel={(customer) => customer.name}
            columnLayout={columnVisibility}
            minWidth={1680}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewCustomer}
            onRowDoubleClick={canUpdateCustomers ? openEditForm : undefined}
            emptyState={
              <>
                <p className="text-muted-foreground">No customers match your search or filters.</p>
                {canCreateCustomers ? (
                  <Button className="mt-4" onClick={openAddForm}>
                    <Plus className="h-4 w-4" />
                    Add customer
                  </Button>
                ) : null}
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
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

      <CustomerViewSheet
        customer={viewCustomer}
        open={Boolean(viewCustomer)}
        canDelete={canDeleteCustomers}
        canEdit={canUpdateCustomers}
        onOpenChange={(open) => {
          if (!open) setViewCustomer(null);
        }}
        onEdit={openEditForm}
        onDelete={(customer) => {
          setViewCustomer(null);
          openDeleteTarget({ mode: "single", customer });
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
            <DialogTitle>{formMode === "edit" ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            key={editingCustomer?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingCustomer
                ? customerToFormValues(editingCustomer)
                : createEmptyCustomerForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add customer"}
            isSubmitting={isSaving}
            onSubmit={saveCustomer}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete customer
              {deleteTarget?.mode === "bulk" && deleteTarget.ids.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.mode === "bulk"
                ? `This will permanently remove ${deleteTarget.ids.length} selected customer${deleteTarget.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
                : deleteTarget?.mode === "single"
                  ? `This will permanently remove "${deleteTarget.customer.name}". This action cannot be undone.`
                  : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              {isSaving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
