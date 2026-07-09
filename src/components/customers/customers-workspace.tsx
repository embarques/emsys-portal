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
import { CustomerTableAddressCell } from "@/components/customers/customer-addresses-sheet";
import { CustomerTablePhoneCell } from "@/components/customers/customer-table-phone-cell";
import { CustomerViewSheet } from "@/components/customers/customer-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
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
import { useCustomerFilterFields } from "@/lib/customers/hooks/use-customer-filter-fields";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { formatPaginatedListSummary, buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatAccountBalance,
  getClientTypeBadgeClass,
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
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
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
import { useTranslation } from "@/lib/i18n";
import { formatCustomerMutationError } from "@/lib/customers/customer-create-error";
import { useUserError } from "@/lib/errors";
import { isCustomerReceiverType } from "@/lib/customers/customer-type";
import { useTableSort } from "@/lib/table/use-table-sort";
import { cn } from "@/lib/utils";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_CUSTOMER_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;
const CUSTOMERS_TABLE_COLUMN_STORAGE_KEY = "customers-v7";

const defaultFilters: CustomerFilterState = {
  query: "",
  rows: [],
};

type CustomerDeleteTarget =
  | { mode: "single"; customer: Customer }
  | { mode: "bulk"; ids: string[] };

export function CustomersWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage, formatError } = useUserError();
  const customerFilterFields = useCustomerFilterFields();
  const { hasPermission } = useAuth();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
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
  const { sort, onSortChange } = useTableSort(DEFAULT_CUSTOMER_LIST_PARAMS.sort, () => setPage(1));
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
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching, isPending } = useCustomers(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
  const stats = useCustomerStats();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomersMutation = useDeleteCustomers();

  const customers = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
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

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({
        feature: "customers",
        baseHref: "/customers",
        mode: "add",
        label: t("customers.actions.add"),
      });
      return;
    }
    setEditingCustomer(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(customer: Customer) {
    if (isDesktopTabs) {
      setViewCustomer(null);
      openFormTab({
        feature: "customers",
        baseHref: "/customers",
        mode: "edit",
        entityId: customer.id,
        label: t("customers.actions.editNamed", { name: customer.name }),
      });
      return;
    }
    setEditingCustomer(customer);
    setFormMode("edit");
    setViewCustomer(null);
    setFormError(null);
  }

  function openViewCustomer(customer: Customer) {
    setViewCustomer(customer);
  }

  async function saveCustomer(values: CustomerFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingCustomer) {
        const nextCustomer = await updateCustomerMutation.mutateAsync({
          customerId: editingCustomer.id,
          values,
        });
        notifyUpdated(t("customers.entity"), nextCustomer.name);
      } else {
        const nextCustomer = await createCustomerMutation.mutateAsync(values);
        notifyAdded(t("customers.entity"), nextCustomer.name);
      }

      setFormMode(null);
      setEditingCustomer(null);
      setPage(1);
    } catch (mutationError) {
      const { status, category } = formatError(mutationError);
      setFormError(
        formatCustomerMutationError(mutationError, t, {
          mode: formMode === "edit" ? "edit" : "create",
          hint:
            status === 403 || category === "forbidden"
              ? formMode === "edit"
                ? t("customers.form.errors.updateForbidden")
                : t("customers.form.errors.createForbidden")
              : undefined,
        }),
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = deleteTarget.mode === "bulk" ? deleteTarget.ids : [deleteTarget.customer.id];

    try {
      const result = await deleteCustomersMutation.mutateAsync(ids);
      const removedIds = result.deletedIds;

      if (removedIds.length > 0) {
        setSelectedIds((current) => current.filter((id) => !removedIds.includes(id)));
      }

      if (result.failedMessage) {
        if (removedIds.length === 0) {
          setDeleteError(result.failedMessage);
          return;
        }

        closeDeleteDialog();
        setViewCustomer(null);
        notifyDeleted(t("customers.entity"), removedIds.length);
        notifyError(result.failedMessage);
        return;
      }

      closeDeleteDialog();
      setViewCustomer(null);

      if (deleteTarget.mode === "single") {
        notifySuccess(t("customers.dialogs.deletedOne", { name: deleteTarget.customer.name }));
      } else {
        notifyDeleted(t("customers.entity"), removedIds.length);
      }
    } catch (mutationError) {
      const { status, category } = formatError(mutationError);
      setDeleteError(
        toErrorMessage(mutationError, {
          hint:
            status === 403 || category === "forbidden"
              ? t("customers.form.errors.deleteForbidden")
              : undefined,
        }),
      );
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
      label: t("customers.stats.total.label"),
      value: stats.total,
      description: t("customers.stats.total.description"),
      icon: Users,
    },
    {
      label: t("customers.stats.senders.label"),
      value: stats.senders,
      description: t("customers.stats.senders.description"),
      icon: Search,
    },
    {
      label: t("customers.stats.receivers.label"),
      value: stats.receivers,
      description: t("customers.stats.receivers.description"),
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

      const typeLabel =
        option.value === CUSTOMER_TYPE_SENDER
          ? t("customers.types.sender")
          : t("customers.types.receiver");

      return {
        value: String(option.value),
        label: stats.isLoading ? typeLabel : `${typeLabel} (${count.toLocaleString()})`,
      };
    });
  }, [stats.isLoading, stats.receivers, stats.senders, t]);

  const tableColumns: DataTableColumn<Customer>[] = useMemo(
    () => [
    {
      id: "customerType",
      label: t("customers.columns.customerType"),
      truncateCell: false,
      cellClassName: "align-top overflow-visible",
      renderCell: (customer) => {
        const clientType = getCustomerClientType(customer) ?? "sender";
        const typeLabel = isCustomerReceiverType(customer.customerType)
          ? t("customers.types.receiver")
          : t("customers.types.sender");
        return (
          <TableTagText className={getClientTypeBadgeClass(clientType)}>
            {typeLabel}
          </TableTagText>
        );
      },
    },
    {
      id: "name",
      label: t("customers.columns.name"),
      cellClassName: "align-top font-medium",
      renderCell: (customer) => customer.name,
    },
    {
      id: "phone",
      label: t("customers.columns.phone"),
      sortField: "phones.number",
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "max-w-0 align-top"),
      renderCell: (customer) => <CustomerTablePhoneCell customer={customer} />,
    },
    {
      id: "IDNumber",
      label: t("customers.columns.IDNumber"),
      cellClassName: "align-top",
      renderCell: (customer) => customer.IDNumber || t("common.empty.dash"),
    },
    {
      id: "address",
      label: t("customers.columns.address"),
      sortField: "addresses.address1",
      defaultWidth: 225,
      autoFitColumn: false,
      truncateCell: false,
      stopRowClick: true,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "max-w-0 align-top"),
      renderCell: (customer) => <CustomerTableAddressCell customer={customer} />,
    },
    {
      id: "email",
      label: t("customers.columns.email"),
      cellClassName: "align-top",
      renderCell: (customer) => customer.email || t("common.empty.dash"),
    },
    {
      id: "accountBalance",
      label: t("customers.columns.accountBalance"),
      cellClassName: "align-top",
      renderCell: (customer) => formatAccountBalance(customer.accountBalance),
    },
    {
      id: "notes",
      label: t("customers.columns.notes"),
      cellClassName: "max-w-[240px] truncate align-top",
      renderCell: (customer) => customer.notes || t("common.empty.dash"),
    },
    {
      id: "createdByID",
      label: t("customers.columns.createdByID"),
      cellClassName: "align-top text-muted-foreground",
      renderCell: (customer) =>
        customer.createdByID != null ? String(customer.createdByID) : t("common.empty.dash"),
    },
    {
      id: "createdAt",
      label: t("common.audit.dateCreated"),
      cellClassName: "align-top text-muted-foreground",
      renderCell: (customer) =>
        customer.createdAt ? formatAuditDateTime(customer.createdAt) : t("common.empty.dash"),
    },
    {
      id: "updatedAt",
      label: t("common.audit.dateModified"),
      cellClassName: "align-top text-muted-foreground",
      renderCell: (customer) =>
        customer.updatedAt ? formatAuditDateTime(customer.updatedAt) : t("common.empty.dash"),
    },
  ],
    [t],
  );

  const isListFiltered =
    Boolean(debouncedQuery.trim()) || countCompleteFilterRows(filters.rows) > 0;

  const searchResultHint = buildToolbarSearchSummary(
    {
      isFiltered: isListFiltered,
      query: filters.query,
      isSearchPending,
      matched: totalCustomers,
      catalogTotal: stats.total,
      noun: t("customers.noun"),
      isLoading: isFetching && customers.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: customers.length,
      page: currentPage,
      pageSize: PAGE_SIZE,
      total: totalCustomers,
      noun: t("customers.noun"),
      isFiltered: isListFiltered,
      isLoading: isFetching,
      catalogTotal: stats.total,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  const columnVisibility = useColumnVisibility(CUSTOMERS_TABLE_COLUMN_STORAGE_KEY, tableColumns);
  const listErrorMessage = isError ? toErrorMessage(error) : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;

  return (
    <div>
      <PageHeader
        title={t("customers.title")}
        description={t("customers.pages.description")}
        actions={
          canCreateCustomers ? (
            <Button onClick={openAddForm} disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {t("customers.actions.add")}
            </Button>
          ) : null
        }
      />

      <StatCards
        items={statCards.map((stat) => ({
          ...stat,
          value: stats.isLoading ? "…" : stat.value.toLocaleString(),
        }))}
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            searchSummary={searchResultHint ?? undefined}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder={t("customers.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "customers",
                  rows: filters.rows,
                  fields: customerFilterFields,
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
                  fields={customerFilterFields}
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

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={customers.map((customer) => customer.id)}
          totalCount={totalCustomers}
          onSelectedIdsChange={setSelectedIds}
          onView={() => {
            const customer = customers.find((entry) => entry.id === selectedIds[0]);
            if (customer) openViewCustomer(customer);
          }}
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
          <DirectoryTableLoader
            icon={Users}
            title={t("customers.loading.title")}
            description={t("customers.loading.description")}
            columns={t("customers.loading.columns").split(", ")}
          />
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
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={openViewCustomer}
            onRowDoubleClick={canUpdateCustomers ? openEditForm : undefined}
            activeRowId={viewCustomer?.id}
            emptyState={
              <>
                <p className="text-muted-foreground">{t("customers.empty.noMatch")}</p>
                {canCreateCustomers ? (
                  <Button className="mt-4" onClick={openAddForm}>
                    <Plus className="h-4 w-4" />
                    {t("customers.actions.add")}
                  </Button>
                ) : null}
              </>
            }
          />
        )}

        {!showInitialTableLoading ? (
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
              {t("common.actions.previous")}
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              {t("common.actions.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        ) : null}
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
        <DialogContent
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          onOpenAutoFocus={
            formMode === "edit" ? (event) => event.preventDefault() : undefined
          }
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
            <DialogTitle>
              {formMode === "edit" ? t("customers.form.editTitle") : t("customers.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            key={editingCustomer?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingCustomer
                ? customerToFormValues(editingCustomer)
                : createEmptyCustomerForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={
              formMode === "edit" ? t("common.actions.saveChanges") : t("customers.actions.add")
            }
            isSubmitting={isSaving}
            externalError={formError}
            onSubmit={saveCustomer}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.mode === "bulk" && deleteTarget.ids.length > 1
                ? t("customers.dialogs.deleteTitlePlural")
                : t("customers.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.mode === "bulk"
                ? t("customers.dialogs.deleteMany", {
                    count: deleteTarget.ids.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : deleteTarget?.mode === "single"
                  ? t("customers.dialogs.deleteOne", {
                      name: deleteTarget.customer.name,
                      cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                    })
                  : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
