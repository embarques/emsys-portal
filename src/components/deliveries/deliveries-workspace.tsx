"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { DeliveryForm } from "@/components/deliveries/delivery-form";
import { DeliveryViewSheet } from "@/components/deliveries/delivery-view-sheet";
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
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import {
  computeDeliveryKpis,
  formatDeliveryDate,
  formatDeliveryId,
  getDeliveryEmployeeGroup,
} from "@/lib/deliveries/display";
import { DELIVERY_TABLE_FILTER_FIELDS } from "@/lib/deliveries/filter-fields";
import {
  useCreateDelivery,
  useDeleteDeliveries,
  useDeliveries,
  useDeliveryKpis,
  useDeliveryStats,
  useUpdateDelivery,
} from "@/lib/deliveries/hooks/use-deliveries";
import {
  DEFAULT_DELIVERY_LIST_PARAMS,
  buildDeliveryListParams,
  createEmptyDeliveryForm,
  deliveryToFormValues,
  type Delivery,
  type DeliveryContainerRef,
  type DeliveryEmployeeGroupRef,
  type DeliveryFilterState,
  type DeliveryFormValues,
} from "@/lib/deliveries/types";
import { useEmployeeGroupPicker } from "@/lib/employee-groups/hooks/use-employee-groups";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";

const PAGE_SIZE = DEFAULT_DELIVERY_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: DeliveryFilterState = {
  query: "",
  rows: [],
};

export function DeliveriesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<DeliveryFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_DELIVERY_LIST_PARAMS.sort, () => setPage(1));
  const [viewDelivery, setViewDelivery] = useState<Delivery | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Delivery | Delivery[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildDeliveryListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useDeliveries(listParams);
  const stats = useDeliveryStats();
  const kpiQuery = useDeliveryKpis();
  const containersQuery = useContainerPicker(250);
  const employeeGroupsQuery = useEmployeeGroupPicker(250);
  const createDeliveryMutation = useCreateDelivery();
  const updateDeliveryMutation = useUpdateDelivery();
  const deleteDeliveriesMutation = useDeleteDeliveries();

  const deliveries = data?.items ?? [];
  const totalDeliveries = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDeliveries / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    deliveries.length > 0 && deliveries.every((delivery) => selectedIds.includes(delivery.id));
  const isSaving =
    createDeliveryMutation.isPending ||
    updateDeliveryMutation.isPending ||
    deleteDeliveriesMutation.isPending;

  const containerRefs: DeliveryContainerRef[] = useMemo(
    () =>
      (containersQuery.data?.items ?? []).map((container) => ({
        id: container.id,
        name: container.name,
        containerNumber: container.containerNumber,
      })),
    [containersQuery.data?.items],
  );

  const employeeGroupRefs: DeliveryEmployeeGroupRef[] = useMemo(
    () =>
      (employeeGroupsQuery.data?.items ?? []).map((group) => ({
        id: group.id,
        name: group.name,
      })),
    [employeeGroupsQuery.data?.items],
  );

  const containerOptions: SearchableSelectOption[] = useMemo(
    () =>
      containerRefs.map((container) => ({
        value: String(container.id),
        label: container.name,
        description: container.containerNumber || undefined,
        keywords: [container.containerNumber],
      })),
    [containerRefs],
  );

  const employeeGroupOptions: SearchableSelectOption[] = useMemo(
    () =>
      employeeGroupRefs.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    [employeeGroupRefs],
  );

  const kpis = useMemo(() => computeDeliveryKpis(kpiQuery.items), [kpiQuery.items]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...deliveries.map((delivery) => delivery.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !deliveries.some((delivery) => delivery.id === id)));
  }

  function toggleSelect(deliveryId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, deliveryId] : current.filter((entry) => entry !== deliveryId),
    );
  }

  function openAddForm() {
    setEditingDelivery(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(delivery: Delivery) {
    setEditingDelivery(delivery);
    setFormMode("edit");
    setViewDelivery(null);
    setFormError(null);
  }

  async function saveDelivery(values: DeliveryFormValues) {
    setFormError(null);
    const references = { containers: containerRefs, employeeGroups: employeeGroupRefs };

    try {
      if (formMode === "edit" && editingDelivery) {
        const nextDelivery = await updateDeliveryMutation.mutateAsync({
          deliveryId: editingDelivery.id,
          values,
          references,
        });
        notifyUpdated("Delivery", nextDelivery.name);
      } else {
        const nextDelivery = await createDeliveryMutation.mutateAsync({ values, references });
        notifyAdded("Delivery", nextDelivery.name);
      }

      setFormMode(null);
      setEditingDelivery(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((delivery) => delivery.id)
      : [deleteTarget.id];

    try {
      await deleteDeliveriesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewDelivery(null);
      notifyDeleted("Delivery", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total deliveries",
      value: stats.isLoading ? "..." : stats.total.toString(),
      description: "Deliveries on record",
      icon: PackageCheck,
    },
    {
      label: "Scheduled today",
      value: kpiQuery.isLoading ? "..." : kpis.scheduledToday.toString(),
      description: "Delivery date is today",
      icon: CalendarDays,
    },
    {
      label: "Group assigned",
      value: kpiQuery.isLoading ? "..." : kpis.assignedCrew.toString(),
      description: "Deliveries with an employee group",
      icon: Users,
    },
  ];

  const tableColumns: DataTableColumn<Delivery>[] = [
    {
      id: "id",
      label: "#",
      cellClassName: "font-mono text-xs",
      renderCell: (delivery) => formatDeliveryId(delivery.id),
    },
    {
      id: "name",
      label: "Delivery",
      sortField: "name",
      cellClassName: "font-medium",
      renderCell: (delivery) => delivery.name,
    },
    {
      id: "date",
      label: "Date",
      sortField: "date",
      renderCell: (delivery) => formatDeliveryDate(delivery.date),
    },
    {
      id: "container",
      label: "Container",
      sortField: "container.name",
      renderCell: (delivery) => delivery.container?.name || "-",
    },
    {
      id: "containerNumber",
      label: "Container number",
      defaultVisible: false,
      cellClassName: "font-mono text-xs",
      renderCell: (delivery) => delivery.container?.containerNumber || "-",
    },
    {
      id: "employeeGroup",
      label: "Employee group",
      sortField: "employeeGroup.name",
      renderCell: getDeliveryEmployeeGroup,
    },
  ];

  const columnVisibility = useColumnVisibility("deliveries-v1", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, DELIVERY_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalDeliveries,
    catalogTotal: stats.total,
    noun: "deliveries",
    isLoading: isFetching && deliveries.length === 0,
    catalogLoading: stats.isLoading,
  });

  return (
    <div>
      <PageHeader
        title="Deliveries"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add delivery
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
                placeholder="Search deliveries..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${deliveries.length} of ${totalDeliveries} deliveries`}
                presets={{
                  storageKey: "deliveries",
                  rows: filters.rows,
                  fields: DELIVERY_TABLE_FILTER_FIELDS,
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
                  fields={DELIVERY_TABLE_FILTER_FIELDS}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds.map(String)}
          pageRowIds={deliveries.map((delivery) => String(delivery.id))}
          totalCount={totalDeliveries}
          onSelectedIdsChange={(ids) => setSelectedIds(ids.map(Number))}
          onEdit={() => {
            const delivery = deliveries.find((entry) => entry.id === selectedIds[0]);
            if (delivery) openEditForm(delivery);
          }}
          onDelete={() =>
            setDeleteTarget(deliveries.filter((delivery) => selectedIds.includes(delivery.id)))
          }
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Car}
            title="Loading deliveries"
            description="Preparing delivery routes, containers, crews, and package counts..."
            columns={["Delivery", "Date", "Container", "Employee group"]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={deliveries}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(delivery) => String(delivery.id)}
            rowLabel={(delivery) => delivery.name}
            columnLayout={columnVisibility}
            minWidth={1100}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds.map(String)}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id, checked) => toggleSelect(Number(id), checked)}
            onRowClick={setViewDelivery}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {filters.query.trim() ? "No deliveries match your search." : "No deliveries yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add delivery
                </Button>
              </>
            }
          />
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {deliveries.length} of {totalDeliveries} deliveries
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
        ) : null}
      </Card>

      <DeliveryViewSheet
        delivery={viewDelivery}
        open={Boolean(viewDelivery)}
        onOpenChange={(open) => {
          if (!open) setViewDelivery(null);
        }}
        onEdit={openEditForm}
        onDelete={(delivery) => {
          setViewDelivery(null);
          setDeleteTarget(delivery);
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
            <DialogTitle>{formMode === "edit" ? "Edit delivery" : "Add delivery"}</DialogTitle>
          </DialogHeader>
          <DeliveryForm
            key={editingDelivery?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingDelivery
                ? deliveryToFormValues(editingDelivery)
                : createEmptyDeliveryForm()
            }
            containerOptions={containerOptions}
            employeeGroupOptions={employeeGroupOptions}
            submitLabel={formMode === "edit" ? "Save changes" : "Add delivery"}
            externalError={formError}
            onSubmit={saveDelivery}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
            isSubmitting={isSaving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete delivery{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected deliveries. This action cannot be undone.`
                : `This will permanently remove delivery ${deleteTarget?.name ?? ""}. This action cannot be undone.`}
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
