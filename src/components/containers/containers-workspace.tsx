"use client";

import { useDeferredValue, useMemo, useState } from "react";
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
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";
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
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeContainerKpis,
  formatContainerCost,
  formatContainerDate,
  formatContainerId,
  formatOptionalContainerCost,
} from "@/lib/containers/display";
import {
  useContainerKpis,
  useContainerStats,
  useContainers,
  useCreateContainer,
  useDeleteContainers,
  useUpdateContainer,
} from "@/lib/containers/hooks/use-containers";
import {
  DEFAULT_CONTAINER_LIST_PARAMS,
  containerToFormValues,
  createContainerSearchFilter,
  createEmptyContainerForm,
  suggestNextContainerName,
  type Container as ContainerRecord,
  type ContainerFilterState,
  type ContainerFormValues,
} from "@/lib/containers/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_CONTAINER_LIST_PARAMS.limit;

const defaultFilters: ContainerFilterState = {
  query: "",
};

export function ContainersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<ContainerFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [viewContainer, setViewContainer] = useState<ContainerRecord | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingContainer, setEditingContainer] = useState<ContainerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContainerRecord | ContainerRecord[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const search = createContainerSearchFilter(deferredQuery);

    return {
      ...DEFAULT_CONTAINER_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search,
    };
  }, [deferredQuery, page]);

  const { data, isLoading, isError, error, isFetching } = useContainers(listParams);
  const stats = useContainerStats();
  const kpiQuery = useContainerKpis();
  const createContainerMutation = useCreateContainer();
  const updateContainerMutation = useUpdateContainer();
  const deleteContainersMutation = useDeleteContainers();

  const containers = data?.items ?? [];
  const totalContainers = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalContainers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    containers.length > 0 && containers.every((container) => selectedIds.includes(container.id));
  const isSaving =
    createContainerMutation.isPending ||
    updateContainerMutation.isPending ||
    deleteContainersMutation.isPending;

  const suggestedContainerName = useMemo(
    () => suggestNextContainerName(containers),
    [containers],
  );

  const kpis = useMemo(() => computeContainerKpis(kpiQuery.items), [kpiQuery.items]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...containers.map((container) => container.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !containers.some((container) => container.id === id)));
  }

  function toggleSelect(containerId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, containerId] : current.filter((entry) => entry !== containerId),
    );
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

  async function saveContainer(values: ContainerFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingContainer) {
        const nextContainer = await updateContainerMutation.mutateAsync({
          containerId: editingContainer.id,
          values,
        });
        notifyUpdated("Container", nextContainer.name);
      } else {
        const nextContainer = await createContainerMutation.mutateAsync(values);
        notifyAdded("Container", nextContainer.name);
      }

      setFormMode(null);
      setEditingContainer(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((container) => container.id)
      : [deleteTarget.id];

    try {
      await deleteContainersMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewContainer(null);
      notifyDeleted("Container", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total containers",
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: "Containers on record",
      icon: Container,
    },
    {
      label: "In transit",
      value: kpiQuery.isLoading ? "…" : kpis.inTransit.toString(),
      description: "Arrival date not yet passed",
      icon: Ship,
    },
    {
      label: "Total cost",
      value: kpiQuery.isLoading ? "…" : formatContainerCost(kpis.totalCost),
      description: "Combined container costs",
      icon: DollarSign,
    },
  ];

  const tableColumns: DataTableColumn<ContainerRecord>[] = [
    {
      id: "id",
      label: "#",
      cellClassName: "font-mono text-xs",
      renderCell: (container) => formatContainerId(container.id),
    },
    {
      id: "container",
      label: "Container",
      cellClassName: "font-medium",
      renderCell: (container) => container.name,
    },
    {
      id: "containerNumber",
      label: "Container number",
      cellClassName: "font-mono text-xs",
      renderCell: (container) => container.containerNumber || "—",
    },
    {
      id: "booking",
      label: "Booking number",
      renderCell: (container) => container.booking,
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
      id: "company",
      label: "Transport company",
      renderCell: (container) => container.company || "—",
    },
    {
      id: "cost",
      label: "Cost",
      renderCell: (container) => formatOptionalContainerCost(container.cost),
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
      id: "barcodeSequence",
      label: "Barcode seq.",
      defaultVisible: false,
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (container) => (container.barcodeSequence > 0 ? container.barcodeSequence : "—"),
    },
    {
      id: "createdAt",
      label: "Date created",
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDate(container.createdAt),
    },
    {
      id: "updatedAt",
      label: "Date modified",
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDate(container.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("containers-v2", tableColumns);

  return (
    <div>
      <PageHeader
        title="Containers"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add container
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
          selectedIds={selectedIds.map(String)}
          pageRowIds={containers.map((container) => String(container.id))}
          onSelectedIdsChange={(ids) => setSelectedIds(ids.map(Number))}
          onEdit={() => {
            const container = containers.find((entry) => entry.id === selectedIds[0]);
            if (container) openEditForm(container);
          }}
          onDelete={() =>
            setDeleteTarget(containers.filter((container) => selectedIds.includes(container.id)))
          }
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={containers}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(container) => String(container.id)}
            rowLabel={(container) => container.name}
            columnLayout={columnVisibility}
            minWidth={1400}
            selectable
            selectedIds={selectedIds.map(String)}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id, checked) => toggleSelect(Number(id), checked)}
            onRowClick={setViewContainer}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {filters.query.trim() ? "No containers match your search." : "No containers yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add container
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {containers.length} of {totalContainers} containers
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
            key={editingContainer?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingContainer
                ? containerToFormValues(editingContainer)
                : createEmptyContainerForm()
            }
            isEditing={formMode === "edit"}
            suggestedContainerName={formMode === "add" ? suggestedContainerName : undefined}
            submitLabel={formMode === "edit" ? "Save changes" : "Add container"}
            onSubmit={saveContainer}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
            isSubmitting={isSaving}
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
                : `This will permanently remove container ${deleteTarget?.name ?? ""}. This action cannot be undone.`}
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
