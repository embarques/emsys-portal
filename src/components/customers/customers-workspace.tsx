"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerViewSheet } from "@/components/customers/customer-view-sheet";
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
import {
  formatAccountBalance,
  formatAddressSummary,
  formatCustomerBranchLabel,
  formatPhoneSummary,
  getClientTypeBadgeClass,
  getClientTypeLabel,
  getCustomerActiveBadgeClass,
  getCustomerActiveLabel,
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
  CUSTOMER_SEARCH_FIELDS,
  CUSTOMER_TYPE_OPTIONS,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  createCustomerSearchFilter,
  createEmptyCustomerForm,
  customerToFormValues,
  getCustomerClientType,
  getCustomerSearchOperatorsForField,
  getDefaultCustomerSearchOperator,
  type Customer,
  type CustomerFilterState,
  type CustomerFormValues,
} from "@/lib/customers/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_CUSTOMER_LIST_PARAMS.limit;

const defaultFilters: CustomerFilterState = {
  query: "",
  searchField: "name",
  searchOperator: "startsWith",
  branch: "all",
  active: "all",
  customerType: "all",
};

type CustomerDeleteTarget =
  | { mode: "single"; customer: Customer }
  | { mode: "bulk"; ids: string[] };

export function CustomersWorkspace() {
  const { hasPermission } = useAuth();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const canDeleteCustomers = hasPermission(
    PERMISSIONS.clientsDelete.name,
    PERMISSIONS.clientsDelete.resourceType,
  );
  const [filters, setFilters] = useState<CustomerFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
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

  const listParams = useMemo(() => {
    const search = createCustomerSearchFilter(deferredQuery, filters.searchField, filters.searchOperator);

    return {
      ...DEFAULT_CUSTOMER_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search,
      branch: filters.branch,
      active: filters.active,
      customerType: filters.customerType,
    };
  }, [
    deferredQuery,
    filters.active,
    filters.branch,
    filters.customerType,
    filters.searchField,
    filters.searchOperator,
    page,
  ]);

  const { data, isLoading, isError, error, isFetching, isPending } = useCustomers(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker();
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
    { label: "Total customers", value: stats.total.toString(), description: "All customer records", icon: Users },
    { label: "Active", value: stats.active.toString(), description: "Active customers", icon: UserPlus },
    { label: "Inactive", value: stats.inactive.toString(), description: "Inactive customers", icon: UserCheck },
    {
      label: "Customer type 1",
      value: stats.type1.toString(),
      description: "Customers with customerType = 1",
      icon: Search,
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

  const activeFilters: { value: CustomerFilterState["active"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];

  const customerTypeFilters: { value: CustomerFilterState["customerType"]; label: string }[] = [
    { value: "all", label: "All types" },
    ...CUSTOMER_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  ];

  const tableColumns: DataTableColumn<Customer>[] = [
    {
      id: "id",
      label: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (customer) => truncateCustomerId(customer.id),
    },
    {
      id: "oldID",
      label: "oldID",
      cellClassName: "font-mono text-xs",
      renderCell: (customer) => (customer.oldID > 0 ? String(customer.oldID) : "—"),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (customer) => customer.name,
    },
    {
      id: "active",
      label: "active",
      renderCell: (customer) => (
        <Badge className={getCustomerActiveBadgeClass(customer.active)}>
          {getCustomerActiveLabel(customer.active)}
        </Badge>
      ),
    },
    {
      id: "customerType",
      label: "customerType",
      renderCell: (customer) => getCustomerTypeLabel(customer),
    },
    {
      id: "clientType",
      label: "client type",
      renderCell: (customer) => {
        const clientType = getCustomerClientType(customer);
        if (!clientType) return "—";
        return (
          <Badge className={getClientTypeBadgeClass(clientType)}>{getClientTypeLabel(clientType)}</Badge>
        );
      },
    },
    {
      id: "branch",
      label: "branch",
      renderCell: (customer) => (
        <Badge className={getCustomerBranchBadgeClass(customer)}>{formatCustomerBranchLabel(customer)}</Badge>
      ),
    },
    {
      id: "branch.code",
      label: "branch.code",
      renderCell: (customer) => customer.branch.code || "—",
    },
    {
      id: "phone1",
      label: "phone1",
      renderCell: (customer) => formatPhoneDisplayOrDash(customer.phone1),
    },
    {
      id: "phone2",
      label: "phone2",
      renderCell: (customer) => formatPhoneDisplayOrDash(customer.phone2),
    },
    {
      id: "email",
      label: "email",
      renderCell: (customer) => customer.email || "—",
    },
    {
      id: "IDNumber",
      label: "IDNumber",
      renderCell: (customer) => customer.IDNumber || "—",
    },
    {
      id: "phones",
      label: "phones",
      renderCell: (customer) => formatPhoneSummary(customer),
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
      id: "address.address1",
      label: "address.address1",
      renderCell: (customer) => customer.address.address1 || "—",
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
      id: "address.country",
      label: "address.country",
      renderCell: (customer) => customer.address.country || "—",
    },
    {
      id: "address",
      label: "address",
      renderCell: (customer) => formatAddressSummary(customer),
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
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (customer) => (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(customer)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          {canDeleteCustomers ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setViewCustomer(null);
                openDeleteTarget({ mode: "single", customer });
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("customers", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const searchOperatorOptions = useMemo(
    () =>
      getCustomerSearchOperatorsForField(filters.searchField).map((operator) => ({
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
        title="Customers"
        description="Customer records from the EMSYS API with contact info, addresses, account balance, and branch."
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.isLoading ? "…" : stat.value}</div>
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
              <CardTitle>Customer directory</CardTitle>
              <CardDescription>
                Server-backed list from GET /customers with pagination, sorting, and API search filters.
              </CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  const searchField = event.target.value as CustomerFilterState["searchField"];
                  setFilters((current) => {
                    const allowedOperators = getCustomerSearchOperatorsForField(searchField);
                    const searchOperator = allowedOperators.includes(current.searchOperator)
                      ? current.searchOperator
                      : getDefaultCustomerSearchOperator(searchField);

                    return {
                      ...current,
                      searchField,
                      searchOperator,
                    };
                  });
                  setPage(1);
                }}
              >
                {CUSTOMER_SEARCH_FIELDS.map((option) => (
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
                    searchOperator: event.target.value as CustomerFilterState["searchOperator"],
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
                  placeholder="Search customers..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</span>
            {branchesLoading && branchFilters.length <= 1 ? (
              <span className="text-sm text-muted-foreground">Loading branches…</span>
            ) : null}
            {branchFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.branch === option.value ? "default" : "outline"}
                disabled={branchesLoading && option.value !== "all"}
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer type</span>
            {customerTypeFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.customerType === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, customerType: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
            {filters.query ||
            filters.branch !== "all" ||
            filters.active !== "all" ||
            filters.customerType !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilters(defaultFilters);
                  setPage(1);
                }}
              >
                Clear search & filters
              </Button>
            ) : null}
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
              {canDeleteCustomers ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => openDeleteTarget({ mode: "bulk", ids: [...selectedIds] })}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showInitialTableLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading customers…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={customers}
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
            emptyState={
              <>
                <p className="text-muted-foreground">No customers match your search or filters.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add customer
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isFetching
              ? "Refreshing customers…"
              : `Showing ${customers.length} of ${totalCustomers} customers`}
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

      <CustomerViewSheet
        customer={viewCustomer}
        open={Boolean(viewCustomer)}
        canDelete={canDeleteCustomers}
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
            <DialogDescription>
              Fields match the EMSYS customer API model: name, contact info, addresses, branch, customerType,
              notes, and account balance.
            </DialogDescription>
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
