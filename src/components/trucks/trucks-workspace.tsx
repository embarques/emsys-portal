"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Fuel,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck as TruckIcon,
} from "lucide-react";

import { TruckForm } from "@/components/trucks/truck-form";
import { TruckViewSheet } from "@/components/trucks/truck-view-sheet";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeTruckKpis,
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
  truncateTruckId,
  truckMatchesQuery,
} from "@/lib/trucks/display";
import { cloneTrucks } from "@/lib/trucks/mock-data";
import {
  FUEL_TYPES,
  TRUCK_BRANCHES,
  createEmptyTruckForm,
  formValuesToTruck,
  truckToFormValues,
  type Truck,
  type TruckFilterState,
  type TruckFormValues,
} from "@/lib/trucks/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: TruckFilterState = {
  query: "",
  fuelType: "all",
  branch: "all",
};

export function TrucksWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [trucks, setTrucks] = useState<Truck[]>(() => cloneTrucks());
  const [filters, setFilters] = useState<TruckFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewTruck, setViewTruck] = useState<Truck | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Truck | Truck[] | null>(null);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      if (!truckMatchesQuery(truck, filters.query)) return false;
      if (filters.fuelType !== "all" && truck.fuelType !== filters.fuelType) return false;
      if (filters.branch !== "all" && truck.branch !== filters.branch) return false;
      return true;
    });
  }, [filters, trucks]);

  const kpis = useMemo(() => computeTruckKpis(trucks), [trucks]);
  const totalPages = Math.max(1, Math.ceil(filteredTrucks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTrucks = filteredTrucks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageTrucks.length > 0 && pageTrucks.every((truck) => selectedIds.includes(truck.truckId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageTrucks.map((truck) => truck.truckId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageTrucks.some((truck) => truck.truckId === id)));
  }

  function toggleSelect(truckId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, truckId] : current.filter((entry) => entry !== truckId)));
  }

  function openAddForm() {
    setEditingTruck(null);
    setFormMode("add");
  }

  function openEditForm(truck: Truck) {
    setEditingTruck(truck);
    setFormMode("edit");
    setViewTruck(null);
  }

  function saveTruck(values: TruckFormValues) {
    if (formMode === "edit" && editingTruck) {
      const nextTruck = formValuesToTruck(
        values,
        editingTruck.createdAt,
        editingTruck.createdBy,
        new Date().toISOString()
      );
      setTrucks((current) =>
        current.map((truck) => (truck.truckId === editingTruck.truckId ? nextTruck : truck))
      );
      notifyUpdated("Truck", nextTruck.name);
    } else {
      const nextTruck = formValuesToTruck(values);
      setTrucks((current) => [nextTruck, ...current]);
      notifyAdded("Truck", nextTruck.name);
    }

    setFormMode(null);
    setEditingTruck(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((truck) => truck.truckId) : [deleteTarget.truckId];
    setTrucks((current) => current.filter((truck) => !ids.includes(truck.truckId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewTruck(null);
    notifyDeleted("Truck", ids.length);
  }

  const stats = [
    { label: "Total trucks", value: kpis.total.toString(), description: "Fleet units on record", icon: TruckIcon },
    { label: "USA", value: kpis.usa.toString(), description: "United States branch", icon: Fuel },
    { label: "DR", value: kpis.dr.toString(), description: "Dominican Republic branch", icon: Fuel },
  ];

  const fuelTypeFilters: { value: TruckFilterState["fuelType"]; label: string }[] = [
    { value: "all", label: "All" },
    ...FUEL_TYPES,
  ];

  const branchFilters: { value: TruckFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All" },
    ...TRUCK_BRANCHES,
  ];

  const tableColumns: DataTableColumn<Truck>[] = [
    {
      id: "truckId",
      label: "Truck ID",
      cellClassName: "font-mono text-xs",
      renderCell: (truck) => truncateTruckId(truck.truckId),
    },
    {
      id: "name",
      label: "Name",
      cellClassName: "font-medium",
      renderCell: (truck) => truck.name,
    },
    {
      id: "vin",
      label: "VIN",
      cellClassName: "font-mono text-xs",
      renderCell: (truck) => truck.vin,
    },
    {
      id: "year",
      label: "Year",
      renderCell: (truck) => truck.year,
    },
    {
      id: "fuelType",
      label: "Fuel type",
      renderCell: (truck) => (
        <Badge className={getFuelTypeBadgeClass(truck.fuelType)}>{getFuelTypeLabel(truck.fuelType)}</Badge>
      ),
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (truck) => (
        <Badge className={getBranchBadgeClass(truck.branch)}>{getBranchLabel(truck.branch)}</Badge>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (truck) => formatAuditDate(truck.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (truck) => truck.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (truck) => formatAuditDate(truck.updatedAt),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (truck) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Edit ${truck.name}`}
            onClick={() => openEditForm(truck)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${truck.name}`}
            onClick={() => {
              setViewTruck(null);
              setDeleteTarget(truck);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("trucks", tableColumns);

  return (
    <div>
      <PageHeader
        title="Trucks"
        description="Manage fleet trucks with VIN, year, fuel type, and branch details."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add truck
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
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
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Fleet directory</CardTitle>
              <CardDescription>Search by truck name, ID, VIN, year, or branch.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md lg:justify-end">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search trucks..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fuel type</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</span>
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
            {filters.query || filters.fuelType !== "all" || filters.branch !== "all" ? (
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

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget(trucks.filter((truck) => selectedIds.includes(truck.truckId)))}
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageTrucks}
          rowKey={(truck) => truck.truckId}
          rowLabel={(truck) => truck.name}
          columnLayout={columnVisibility}
          minWidth={1000}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewTruck}
          emptyState={
            <>
              <p className="text-muted-foreground">No trucks match your search or filters.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add truck
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageTrucks.length} of {filteredTrucks.length} trucks
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
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
              disabled={currentPage >= totalPages}
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

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit truck" : "Add truck"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update truck name, VIN, year, and fuel type."
                : "Register a new fleet truck with a generated truck ID."}
            </DialogDescription>
          </DialogHeader>
          <TruckForm
            key={editingTruck?.truckId ?? "new"}
            initialValues={
              formMode === "edit" && editingTruck ? truckToFormValues(editingTruck) : createEmptyTruckForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingTruck?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add truck"}
            onSubmit={saveTruck}
            onCancel={() => setFormMode(null)}
          />
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
