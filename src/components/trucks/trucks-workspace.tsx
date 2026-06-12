"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Fuel,
  Plus,
  Trash2,
  Truck as TruckIcon,
} from "lucide-react";

import { TruckForm } from "@/components/trucks/truck-form";
import { TruckViewSheet } from "@/components/trucks/truck-view-sheet";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeTruckKpis,
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
  truncateObjectId,
  truncateTruckId,
} from "@/lib/trucks/display";
import {
  useCreateTruck,
  useDeleteTrucks,
  useTrucks,
  useUpdateTruck,
} from "@/lib/trucks/hooks/use-trucks";
import {
  DEFAULT_TRUCK_LIST_PARAMS,
  TRUCK_BRANCH_OPTIONS,
  TRUCK_FUEL_TYPES,
  createEmptyTruckForm,
  createTruckSearchFilter,
  truckToFormValues,
  type Truck,
  type TruckFilterState,
  type TruckFormValues,
} from "@/lib/trucks/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_TRUCK_LIST_PARAMS.limit;

const defaultFilters: TruckFilterState = {
  query: "",
  fuelType: "all",
  branch: "all",
};

export function TrucksWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<TruckFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewTruck, setViewTruck] = useState<Truck | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Truck | Truck[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const hasSearch = Boolean(deferredQuery.trim());
    const hasFuelFilter = filters.fuelType !== "all";
    const hasBranchFilter = filters.branch !== "all";

    return {
      ...DEFAULT_TRUCK_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      ...(hasSearch ? { search: createTruckSearchFilter(deferredQuery) } : {}),
      ...(hasFuelFilter ? { fuelType: filters.fuelType } : {}),
      ...(hasBranchFilter ? { branch: filters.branch } : {}),
    };
  }, [deferredQuery, filters.branch, filters.fuelType, page]);

  const { data, isLoading, isError, error, isFetching } = useTrucks(listParams);
  const createTruckMutation = useCreateTruck();
  const updateTruckMutation = useUpdateTruck();
  const deleteTrucksMutation = useDeleteTrucks();

  const trucks = data?.items ?? [];
  const totalTrucks = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTrucks / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = trucks.length > 0 && trucks.every((truck) => selectedIds.includes(truck.id));
  const isSaving =
    createTruckMutation.isPending || updateTruckMutation.isPending || deleteTrucksMutation.isPending;

  const kpis = useMemo(() => computeTruckKpis(trucks), [trucks]);

  const statCards = [
    {
      label: "Total trucks",
      value: isLoading ? "…" : totalTrucks.toString(),
      description: "Fleet units on record",
      icon: TruckIcon,
    },
    {
      label: "USA",
      value: isLoading ? "…" : kpis.usa.toString(),
      description: "On this page",
      icon: Fuel,
    },
    {
      label: "DR",
      value: isLoading ? "…" : kpis.dr.toString(),
      description: "On this page",
      icon: Fuel,
    },
  ];

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...trucks.map((truck) => truck.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !trucks.some((truck) => truck.id === id)));
  }

  function toggleSelect(truckId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, truckId] : current.filter((entry) => entry !== truckId)));
  }

  function openAddForm() {
    setEditingTruck(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(truck: Truck) {
    setEditingTruck(truck);
    setFormMode("edit");
    setViewTruck(null);
    setFormError(null);
  }

  async function saveTruck(values: TruckFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingTruck) {
        const nextTruck = await updateTruckMutation.mutateAsync({
          truckId: editingTruck.id,
          values,
        });
        notifyUpdated("Truck", nextTruck.name);
      } else {
        const nextTruck = await createTruckMutation.mutateAsync(values);
        notifyAdded("Truck", nextTruck.name);
      }

      setFormMode(null);
      setEditingTruck(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((truck) => truck.id) : [deleteTarget.id];

    try {
      await deleteTrucksMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewTruck(null);
      notifyDeleted("Truck", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const fuelTypeFilters: { value: TruckFilterState["fuelType"]; label: string }[] = [
    { value: "all", label: "All" },
    ...TRUCK_FUEL_TYPES,
  ];

  const branchFilters: { value: TruckFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All" },
    ...TRUCK_BRANCH_OPTIONS,
  ];

  const tableColumns: DataTableColumn<Truck>[] = [
    {
      id: "id",
      label: "Record ID",
      cellClassName: "font-mono text-xs",
      renderCell: (truck) => truncateObjectId(truck.id),
    },
    {
      id: "truckId",
      label: "truckId",
      cellClassName: "font-mono text-xs",
      renderCell: (truck) => truncateTruckId(truck.truckId) || "—",
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (truck) => truck.name,
    },
    {
      id: "vin",
      label: "vin",
      cellClassName: "font-mono text-xs",
      renderCell: (truck) => truck.vin || "—",
    },
    {
      id: "year",
      label: "year",
      renderCell: (truck) => (truck.year > 0 ? truck.year : "—"),
    },
    {
      id: "fuelType",
      label: "fuelType",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (truck) => (
        <UniformWidthPill columnKey="fuelType">
          <Badge className={getFuelTypeBadgeClass(truck.fuelType)}>{getFuelTypeLabel(truck.fuelType)}</Badge>
        </UniformWidthPill>
      ),
    },
    {
      id: "branch",
      label: "branch",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (truck) => (
        <UniformWidthPill columnKey="branch">
          <Badge className={getBranchBadgeClass(truck.branch)}>{getBranchLabel(truck.branch)}</Badge>
        </UniformWidthPill>
      ),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (truck) => (truck.createdAt ? formatAuditDate(truck.createdAt) : "—"),
    },
    {
      id: "createdBy",
      label: "createdBy",
      defaultVisible: false,
      renderCell: (truck) => truck.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (truck) => (truck.updatedAt ? formatAuditDate(truck.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("trucks-v2", tableColumns);
  const activeFilterCount =
    (filters.fuelType !== "all" ? 1 : 0) + (filters.branch !== "all" ? 1 : 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) || filters.fuelType !== "all" || filters.branch !== "all";

  return (
    <div>
      <PageHeader
        title="Trucks"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add truck
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
                placeholder="Search trucks..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${trucks.length} of ${totalTrucks} trucks`}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableFilterSection label="Fuel type">
                  {fuelTypeFilters.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={filters.fuelType === option.value ? "default" : "outline"}
                      onClick={() => {
                        setFilters((current) => ({ ...current, fuelType: option.value }));
                        setPage(1);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </TableFilterSection>

                <TableFilterSection label="Branch">
                  {branchFilters.map((option) => (
                    <Button
                      key={option.value}
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
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={trucks.map((truck) => truck.id)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const truck = trucks.find((entry) => entry.id === selectedIds[0]);
            if (truck) openEditForm(truck);
          }}
          onDelete={() => setDeleteTarget(trucks.filter((truck) => selectedIds.includes(truck.id)))}
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={trucks}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(truck) => truck.id}
            rowLabel={(truck) => truck.name}
            columnLayout={columnVisibility}
            minWidth={1200}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewTruck}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? "No trucks match your search or filters." : "No trucks yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add truck
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {trucks.length} of {totalTrucks} trucks
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

      <TruckViewSheet
        truck={viewTruck}
        open={Boolean(viewTruck)}
        onOpenChange={(open) => {
          if (!open) setViewTruck(null);
        }}
        onEdit={openEditForm}
        onDelete={(truck) => {
          setViewTruck(null);
          setDeleteTarget(truck);
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit truck" : "Add truck"}</DialogTitle>
          </DialogHeader>
          <TruckForm
            key={editingTruck?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingTruck ? truckToFormValues(editingTruck) : createEmptyTruckForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add truck"}
            isSubmitting={isSaving}
            onSubmit={saveTruck}
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
            <DialogTitle>Delete truck{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected trucks. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this truck"}. This action cannot be undone.`}
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
