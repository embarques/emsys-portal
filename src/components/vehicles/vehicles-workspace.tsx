"use client";

import { useMemo, useState } from "react";
import {
  Car,
  Fuel,
  Plus,
  Trash2,
} from "lucide-react";

import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { VehicleViewSheet } from "@/components/vehicles/vehicle-view-sheet";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  computeVehicleKpis,
  formatVehicleDate,
  getBranchBadgeClass,
  getFuelTypeBadgeClass,
  getVehicleActiveBadgeClass,
} from "@/lib/vehicles/display";
import { useVehicleFilterFields } from "@/lib/vehicles/hooks/use-vehicle-filter-fields";
import { useVehicleLabels } from "@/lib/vehicles/hooks/use-vehicle-labels";
import {
  useCreateVehicle,
  useDeleteVehicles,
  useVehicleKpis,
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
  areVehicleFormValuesEquivalent,
} from "@/lib/vehicles/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: VehicleFilterState = {
  query: "",
  rows: [],
};

export function VehiclesWorkspace() {
  const { t } = useTranslation();
  const vehicleLabels = useVehicleLabels();
  const vehicleFilterFields = useVehicleFilterFields();
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const [filters, setFilters] = useState<VehicleFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
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
        limit: pageLimit,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useVehicles(listParams);
  const createVehicleMutation = useCreateVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const deleteVehiclesMutation = useDeleteVehicles();

  const vehicles = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalVehicles = data?.total ?? 0;
  rememberTotal(totalVehicles);
  const totalPages = Math.max(1, Math.ceil(totalVehicles / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = vehicles.length > 0 && vehicles.every((vehicle) => selectedIds.includes(vehicle.id));
  const isSaving =
    createVehicleMutation.isPending || updateVehicleMutation.isPending || deleteVehiclesMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  const branchKpis = useVehicleKpis();
  const branchCounts = computeVehicleKpis(branchKpis.items);

  const statCards = [
    {
      label: t("vehicles.stats.total.label"),
      value: isLoading ? "…" : totalVehicles.toString(),
      description: t("vehicles.stats.total.description"),
      icon: Car,
    },
    {
      label: t("vehicles.stats.usa.label"),
      value: branchKpis.isLoading ? "…" : branchCounts.usa.toString(),
      description: t("vehicles.stats.usa.description"),
      icon: Fuel,
    },
    {
      label: t("vehicles.stats.dr.label"),
      value: branchKpis.isLoading ? "…" : branchCounts.dr.toString(),
      description: t("vehicles.stats.dr.description"),
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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "vehicles", baseHref: "/vehicles", mode: "add", label: t("vehicles.actions.add") });
      return;
    }
    setEditingVehicle(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(vehicle: Vehicle) {
    if (isDesktopTabs) {
      setViewVehicle(null);
      openFormTab({
        feature: "vehicles",
        baseHref: "/vehicles",
        mode: "edit",
        entityId: vehicle.id,
        label: t("vehicles.actions.editNamed", { name: vehicle.name }),
      });
      return;
    }
    setEditingVehicle(vehicle);
    setFormMode("edit");
    setViewVehicle(null);
    setFormError(null);
  }

  async function saveVehicle(values: VehicleFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingVehicle) {
        if (areVehicleFormValuesEquivalent(values, vehicleToFormValues(editingVehicle))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingVehicle(null);
          return;
        }

        const nextVehicle = await updateVehicleMutation.mutateAsync({
          vehicleId: editingVehicle.id,
          values,
        });
        notifyUpdated(t("vehicles.entity"), nextVehicle.name);
      } else {
        const nextVehicle = await createVehicleMutation.mutateAsync(values);
        notifyAdded(t("vehicles.entity"), nextVehicle.name);
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
      notifyDeleted(t("vehicles.entity"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const dash = t("common.empty.dash");

  const tableColumns: DataTableColumn<Vehicle>[] = useMemo(
    () => [
      {
        id: "name",
        label: t("vehicles.columns.name"),
        cellClassName: "font-medium",
        renderCell: (vehicle) => vehicle.name,
      },
      {
        id: "vin",
        label: t("vehicles.columns.vin"),
        cellClassName: "font-mono text-xs",
        renderCell: (vehicle) => vehicle.vin || dash,
      },
      {
        id: "licensePlate",
        label: t("vehicles.columns.licensePlate"),
        cellClassName: "font-mono text-xs",
        renderCell: (vehicle) => vehicle.licensePlate || dash,
      },
      {
        id: "year",
        label: t("vehicles.columns.year"),
        renderCell: (vehicle) => (vehicle.year > 0 ? vehicle.year : dash),
      },
      {
        id: "fuelType",
        label: t("vehicles.columns.fuelType"),
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (vehicle) => (
          <TableTagText className={getFuelTypeBadgeClass(vehicle.fuelType)}>
            {vehicleLabels.fuelType(vehicle.fuelType)}
          </TableTagText>
        ),
      },
      {
        id: "branch",
        label: t("vehicles.columns.branch"),
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (vehicle) => (
          <TableTagText className={getBranchBadgeClass(vehicle.branch.code, branches)}>
            {vehicleLabels.branch(vehicle.branch.code)}
          </TableTagText>
        ),
      },
      {
        id: "active",
        label: t("vehicles.columns.status"),
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (vehicle) => (
          <TableTagText className={getVehicleActiveBadgeClass(vehicle.active)}>
            {vehicleLabels.active(vehicle.active)}
          </TableTagText>
        ),
      },
      {
        id: "inspectionDate",
        label: t("vehicles.columns.inspectionDate"),
        cellClassName: "text-muted-foreground",
        renderCell: (vehicle) => formatVehicleDate(vehicle.inspectionDate),
      },
      {
        id: "registrationDate",
        label: t("vehicles.columns.registrationDate"),
        cellClassName: "text-muted-foreground",
        renderCell: (vehicle) => formatVehicleDate(vehicle.registrationDate),
      },
      {
        id: "createdAt",
        label: t("vehicles.columns.createdAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (vehicle) => (vehicle.createdAt ? formatAuditDateTime(vehicle.createdAt) : dash),
      },
      {
        id: "createdBy",
        label: t("vehicles.columns.createdBy"),
        defaultVisible: false,
        cellClassName: "text-muted-foreground",
        renderCell: (vehicle) => vehicle.createdBy || dash,
      },
      {
        id: "updatedAt",
        label: t("vehicles.columns.updatedAt"),
        defaultVisible: false,
        cellClassName: "text-muted-foreground",
        renderCell: (vehicle) => (vehicle.updatedAt ? formatAuditDateTime(vehicle.updatedAt) : dash),
      },
    ],
    [branches, dash, t, vehicleLabels],
  );

  const columnVisibility = useColumnVisibility("vehicles-v2", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, vehicleFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalVehicles,
      noun: t("vehicles.noun"),
      isLoading: isFetching && vehicles.length === 0,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: vehicles.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalVehicles,
      noun: t("vehicles.noun"),
      isFiltered: hasActiveFilters,
      isLoading: isFetching,
    },
    t,
  );

  return (
    <div>
      <PageHeader
        title={t("vehicles.title")}
        description={t("vehicles.pages.description")}
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            {t("vehicles.actions.add")}
          </Button>
        }
      />

      <StatCards items={statCards} />

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
                placeholder={t("vehicles.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "vehicles",
                  rows: filters.rows,
                  fields: vehicleFilterFields,
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
                  fields={vehicleFilterFields}
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
          selectedIds={selectedIds}
          pageRowIds={vehicles.map((vehicle) => vehicle.id)}
          totalCount={totalVehicles}
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
            activeRowId={viewVehicle?.id}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("vehicles.empty.noMatch") : t("vehicles.empty.noneYet")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("vehicles.actions.add")}
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
            <DialogTitle>
              {formMode === "edit" ? t("vehicles.form.editTitle") : t("vehicles.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <VehicleForm
            key={editingVehicle?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingVehicle ? vehicleToFormValues(editingVehicle) : createEmptyVehicleForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("vehicles.actions.add")}
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
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("vehicles.dialogs.deleteTitlePlural")
                : t("vehicles.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("vehicles.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("vehicles.dialogs.deleteOne", {
                    name:
                      !Array.isArray(deleteTarget) && deleteTarget?.name
                        ? deleteTarget.name
                        : t("vehicles.dialogs.unnamed"),
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
