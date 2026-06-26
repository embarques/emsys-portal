"use client";

import { useMemo, useState } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Plus,
  Trash2,
} from "lucide-react";

import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { VehicleViewSheet } from "@/components/vehicles/vehicle-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
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
import { VEHICLE_TABLE_FILTER_FIELDS } from "@/lib/vehicles/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatVehicleDate,
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
  truncateObjectId,
  truncateVehicleId,
} from "@/lib/vehicles/display";
import {
  useCreateVehicle,
  useDeleteVehicles,
  useVehicleBranchCount,
  useVehicles,
  useUpdateVehicle,
} from "@/lib/vehicles/hooks/use-vehicles";
import {
  DEFAULT_VEHICLE_LIST_PARAMS,
  buildVehicleListParams,
  createEmptyVehicleForm,
  vehicleToFormValues,
  type Vehicle,
  type VehicleFilterState,
  type VehicleFormValues,
} from "@/lib/vehicles/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_VEHICLE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: VehicleFilterState = {
  query: "",
  rows: [],
};

export function VehiclesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<VehicleFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_VEHICLE_LIST_PARAMS.sort, () => setPage(1));
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | Vehicle[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildVehicleListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useVehicles(listParams);
  const createVehicleMutation = useCreateVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const deleteVehiclesMutation = useDeleteVehicles();

  const vehicles = data?.items ?? [];
  const totalVehicles = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalVehicles / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = vehicles.length > 0 && vehicles.every((vehicle) => selectedIds.includes(vehicle.id));
  const isSaving =
    createVehicleMutation.isPending || updateVehicleMutation.isPending || deleteVehiclesMutation.isPending;

  const usaBranchCount = useVehicleBranchCount("usa");
  const drBranchCount = useVehicleBranchCount("dr");

  const statCards = [
    {
      label: "Total vehicles",
      value: isLoading ? "…" : totalVehicles.toString(),
      description: "Fleet units on record",
      icon: Car,
    },
    {
      label: "USA",
      value: usaBranchCount.isLoading ? "…" : usaBranchCount.count.toString(),
      description: "Total vehicles in USA",
      icon: Fuel,
    },
    {
      label: "DR",
      value: drBranchCount.isLoading ? "…" : drBranchCount.count.toString(),
      description: "Total vehicles in DR",
      icon: Fuel,
    },
  ];

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...vehicles.map((vehicle) => vehicle.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !vehicles.some((vehicle) => vehicle.id === id)));
  }

  function toggleSelect(vehicleId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, vehicleId] : current.filter((entry) => entry !== vehicleId)));
  }

  function openAddForm() {
    setEditingVehicle(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setFormMode("edit");
    setViewVehicle(null);
    setFormError(null);
  }

  async function saveVehicle(values: VehicleFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingVehicle) {
        const nextVehicle = await updateVehicleMutation.mutateAsync({
          vehicleId: editingVehicle.id,
          values,
        });
        notifyUpdated("Vehicle", nextVehicle.name);
      } else {
        const nextVehicle = await createVehicleMutation.mutateAsync(values);
        notifyAdded("Vehicle", nextVehicle.name);
      }

      setFormMode(null);
      setEditingVehicle(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((vehicle) => vehicle.id) : [deleteTarget.id];

    try {
      await deleteVehiclesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewVehicle(null);
      notifyDeleted("Vehicle", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const tableColumns: DataTableColumn<Vehicle>[] = [
    {
      id: "id",
      label: "Record ID",
      cellClassName: "font-mono text-xs",
      renderCell: (vehicle) => truncateObjectId(vehicle.id),
    },
    {
      id: "vehicleId",
      label: "Vehicle ID",
      cellClassName: "font-mono text-xs",
      renderCell: (vehicle) => truncateVehicleId(vehicle.vehicleId) || "—",
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (vehicle) => vehicle.name,
    },
    {
      id: "vin",
      label: "vin",
      cellClassName: "font-mono text-xs",
      renderCell: (vehicle) => vehicle.vin || "—",
    },
    {
      id: "year",
      label: "year",
      renderCell: (vehicle) => (vehicle.year > 0 ? vehicle.year : "—"),
    },
    {
      id: "fuelType",
      label: "fuelType",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (vehicle) => (
        <TableTagText className={getFuelTypeBadgeClass(vehicle.fuelType)}>
          {getFuelTypeLabel(vehicle.fuelType)}
        </TableTagText>
      ),
    },
    {
      id: "branch",
      label: "branch",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (vehicle) => (
        <TableTagText className={getBranchBadgeClass(vehicle.branch)}>
          {getBranchLabel(vehicle.branch)}
        </TableTagText>
      ),
    },
    {
      id: "inspectionDate",
      label: "inspectionDate",
      cellClassName: "text-muted-foreground",
      renderCell: (vehicle) => formatVehicleDate(vehicle.inspectionDate),
    },
    {
      id: "registrationDate",
      label: "registrationDate",
      cellClassName: "text-muted-foreground",
      renderCell: (vehicle) => formatVehicleDate(vehicle.registrationDate),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (vehicle) => (vehicle.createdAt ? formatAuditDate(vehicle.createdAt) : "—"),
    },
    {
      id: "createdBy",
      label: "createdBy",
      defaultVisible: false,
      renderCell: (vehicle) => vehicle.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (vehicle) => (vehicle.updatedAt ? formatAuditDate(vehicle.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("vehicles-v2", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, VEHICLE_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalVehicles,
    noun: "vehicles",
    isLoading: isFetching && vehicles.length === 0,
  });

  return (
    <div>
      <PageHeader
        title="Vehicles"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add vehicle
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
                placeholder="Search vehicles..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${vehicles.length} of ${totalVehicles} vehicles`}
                presets={{
                  storageKey: "vehicles",
                  rows: filters.rows,
                  fields: VEHICLE_TABLE_FILTER_FIELDS,
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
                  fields={VEHICLE_TABLE_FILTER_FIELDS}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={vehicles.map((vehicle) => vehicle.id)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const vehicle = vehicles.find((entry) => entry.id === selectedIds[0]);
            if (vehicle) openEditForm(vehicle);
          }}
          onDelete={() => setDeleteTarget(vehicles.filter((vehicle) => selectedIds.includes(vehicle.id)))}
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={vehicles}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(vehicle) => vehicle.id}
            rowLabel={(vehicle) => vehicle.name}
            columnLayout={columnVisibility}
            minWidth={1200}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewVehicle}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? "No vehicles match your search or filters." : "No vehicles yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add vehicle
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {vehicles.length} of {totalVehicles} vehicles
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

      <VehicleViewSheet
        vehicle={viewVehicle}
        open={Boolean(viewVehicle)}
        onOpenChange={(open) => {
          if (!open) setViewVehicle(null);
        }}
        onEdit={openEditForm}
        onDelete={(vehicle) => {
          setViewVehicle(null);
          setDeleteTarget(vehicle);
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{formMode === "edit" ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          </DialogHeader>
          <VehicleForm
            key={editingVehicle?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingVehicle ? vehicleToFormValues(editingVehicle) : createEmptyVehicleForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add vehicle"}
            isSubmitting={isSaving}
            externalError={formError}
            onSubmit={saveVehicle}
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
            <DialogTitle>Delete vehicle{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected vehicles. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this vehicle"}. This action cannot be undone.`}
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
