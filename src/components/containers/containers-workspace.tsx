"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Container,
  DollarSign,
  Plus,
  Ship,
  Trash2,
} from "lucide-react";

import { ContainerForm } from "@/components/containers/container-form";
import { ContainerViewSheet } from "@/components/containers/container-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeContainerKpis,
  formatContainerCost,
  formatContainerDate,
  containerMatchesQuery,
  truncateContainerId,
} from "@/lib/containers/display";
import { cloneContainers } from "@/lib/containers/mock-data";
import {
  containerToFormValues,
  createEmptyContainerForm,
  formValuesToContainer,
  suggestNextContainerCode,
  type ContainerFilterState,
  type ContainerFormValues,
  type ContainerRecord,
} from "@/lib/containers/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: ContainerFilterState = {
  query: "",
};

export function ContainersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [containers, setContainers] = useState<ContainerRecord[]>(() => cloneContainers());
  const [filters, setFilters] = useState<ContainerFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewContainer, setViewContainer] = useState<ContainerRecord | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingContainer, setEditingContainer] = useState<ContainerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContainerRecord | ContainerRecord[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const suggestedContainerCode = useMemo(
    () => suggestNextContainerCode(containers),
    [containers]
  );

  const filteredContainers = useMemo(() => {
    return containers.filter((container) => containerMatchesQuery(container, filters.query));
  }, [containers, filters.query]);

  const kpis = useMemo(() => computeContainerKpis(containers), [containers]);
  const totalPages = Math.max(1, Math.ceil(filteredContainers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageContainers = filteredContainers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageContainers.length > 0 && pageContainers.every((container) => selectedIds.includes(container.containerId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageContainers.map((container) => container.containerId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageContainers.some((container) => container.containerId === id))
    );
  }

  function toggleSelect(containerId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, containerId] : current.filter((entry) => entry !== containerId)));
  }

  function openAddForm() {
    setEditingContainer(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(container: ContainerRecord) {
    setEditingContainer(container);
    setFormMode("edit");
    setViewContainer(null);
    setFormError(null);
  }

  function saveContainer(values: ContainerFormValues) {
    try {
      if (formMode === "edit" && editingContainer) {
        const nextContainer = formValuesToContainer(
          { ...values, createdBy: editingContainer.createdBy },
          editingContainer.createdAt,
          editingContainer.createdBy,
          new Date().toISOString()
        );
        setContainers((current) =>
          current.map((container) =>
            container.containerId === editingContainer.containerId ? nextContainer : container
          )
        );
        notifyUpdated("Container", nextContainer.containerCode);
      } else {
        const nextContainer = formValuesToContainer(values);
        setContainers((current) => [nextContainer, ...current]);
        notifyAdded("Container", nextContainer.containerCode);
      }

      setFormMode(null);
      setEditingContainer(null);
      setFormError(null);
      setPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save container.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((container) => container.containerId)
      : [deleteTarget.containerId];
    setContainers((current) => current.filter((container) => !ids.includes(container.containerId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewContainer(null);
    notifyDeleted("Container", ids.length);
  }

  const stats = [
    { label: "Total containers", value: kpis.total.toString(), description: "Containers on record", icon: Container },
    { label: "In transit", value: kpis.inTransit.toString(), description: "Arrival date not yet passed", icon: Ship },
    {
      label: "Total cost",
      value: formatContainerCost(kpis.totalCost),
      description: "Combined container costs",
      icon: DollarSign,
    },
  ];

  const tableColumns: DataTableColumn<ContainerRecord>[] = [
    {
      id: "containerId",
      label: "Container ID",
      cellClassName: "font-mono text-xs",
      renderCell: (container) => truncateContainerId(container.containerId),
    },
    {
      id: "containerCode",
      label: "Container",
      cellClassName: "font-medium",
      renderCell: (container) => container.containerCode,
    },
    {
      id: "containerNumber",
      label: "Container number",
      cellClassName: "font-mono text-xs",
      renderCell: (container) => container.containerNumber,
    },
    {
      id: "bookingNumber",
      label: "Booking number",
      renderCell: (container) => container.bookingNumber,
    },
    {
      id: "sealNumber",
      label: "Seal number",
      renderCell: (container) => container.sealNumber || "—",
    },
    {
      id: "broker",
      label: "Broker",
      renderCell: (container) => container.broker || "—",
    },
    {
      id: "transportCompany",
      label: "Transport company",
      renderCell: (container) => container.transportCompany || "—",
    },
    {
      id: "cost",
      label: "Cost",
      renderCell: (container) => formatContainerCost(container.cost),
    },
    {
      id: "departureDate",
      label: "Departure",
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatContainerDate(container.departureDate),
    },
    {
      id: "arrivalDate",
      label: "Arrival",
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatContainerDate(container.arrivalDate),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDate(container.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (container) => container.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDate(container.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("containers", tableColumns);

  return (
    <div>
      <PageHeader
        title="Containers"
        description="Track shipping containers with booking, seal, broker, and transport details."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add container
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
          <CardTitle>Container directory</CardTitle>

          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters({ query });
                  setPage(1);
                }}
                placeholder="Search containers..."
              />
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageContainers.map((container) => container.containerId)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const container = pageContainers.find((entry) => entry.containerId === selectedIds[0]);
            if (container) openEditForm(container);
          }}
          onDelete={() =>
            setDeleteTarget(containers.filter((container) => selectedIds.includes(container.containerId)))
          }
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageContainers}
          page={currentPage}
          rowKey={(container) => container.containerId}
          rowLabel={(container) => container.containerCode}
          columnLayout={columnVisibility}
          minWidth={1400}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewContainer}
          onRowDoubleClick={openEditForm}
          emptyState={
            <>
              <p className="text-muted-foreground">No containers match your search.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add container
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageContainers.length} of {filteredContainers.length} containers
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

      <ContainerViewSheet
        container={viewContainer}
        open={Boolean(viewContainer)}
        onOpenChange={(open) => {
          if (!open) setViewContainer(null);
        }}
        onEdit={openEditForm}
        onDelete={(container) => {
          setViewContainer(null);
          setDeleteTarget(container);
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit container" : "Add container"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update container shipping and logistics details."
                : "Create a new container record with booking and transport information."}
            </DialogDescription>
          </DialogHeader>
          <ContainerForm
            key={editingContainer?.containerId ?? "new"}
            initialValues={
              formMode === "edit" && editingContainer
                ? containerToFormValues(editingContainer)
                : createEmptyContainerForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingContainer?.updatedAt}
            suggestedContainerCode={formMode === "add" ? suggestedContainerCode : undefined}
            submitLabel={formMode === "edit" ? "Save changes" : "Add container"}
            onSubmit={saveContainer}
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
            <DialogTitle>
              Delete container{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected containers. This action cannot be undone.`
                : `This will permanently remove container ${deleteTarget?.containerCode ?? ""}. This action cannot be undone.`}
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
