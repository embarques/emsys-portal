"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Container,
  Plus,
  Ship,
  Trash2,
} from "lucide-react";

import { ContainerForm } from "@/components/containers/container-form";
import { ContainerViewSheet } from "@/components/containers/container-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { useContainerFilterFields } from "@/lib/containers/hooks/use-container-filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";
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
import { useUserError } from "@/lib/errors";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  computeContainerKpis,
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
  buildContainerListParams,
  containerToFormValues,
  createEmptyContainerForm,
  suggestNextContainerName,
  type Container as ContainerRecord,
  type ContainerFilterState,
  type ContainerFormValues,
} from "@/lib/containers/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_CONTAINER_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: ContainerFilterState = {
  query: "",
  rows: [],
};

export function ContainersWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const containerFilterFields = useContainerFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<ContainerFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_CONTAINER_LIST_PARAMS.sort, () => setPage(1));
  const [viewContainer, setViewContainer] = useState<ContainerRecord | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingContainer, setEditingContainer] = useState<ContainerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContainerRecord | ContainerRecord[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildContainerListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useContainers(listParams);
  const stats = useContainerStats();
  const kpiQuery = useContainerKpis();
  const createContainerMutation = useCreateContainer();
  const updateContainerMutation = useUpdateContainer();
  const deleteContainersMutation = useDeleteContainers();

  const containers = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalContainers = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalContainers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    containers.length > 0 && containers.every((container) => selectedIds.includes(container.id));
  const isSaving =
    createContainerMutation.isPending ||
    updateContainerMutation.isPending ||
    deleteContainersMutation.isPending;

  useTableSelectionReset<number>(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "containers", baseHref: "/containers", mode: "add", label: t("containers.actions.add") });
      return;
    }
    setEditingContainer(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(container: ContainerRecord) {
    if (isDesktopTabs) {
      setViewContainer(null);
      openFormTab({
        feature: "containers",
        baseHref: "/containers",
        mode: "edit",
        entityId: String(container.id),
        label: t("containers.actions.editNamed", { name: container.name }),
      });
      return;
    }
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
        notifyUpdated(t("containers.entity"), nextContainer.name);
      } else {
        const nextContainer = await createContainerMutation.mutateAsync(values);
        notifyAdded(t("containers.entity"), nextContainer.name);
      }

      setFormMode(null);
      setEditingContainer(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
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
      notifyDeleted(t("containers.entity"), ids.length);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: t("containers.stats.total.label"),
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: t("containers.stats.total.description"),
      icon: Container,
    },
    {
      label: t("containers.stats.departedPastMonth"),
      value: kpiQuery.isLoading ? "…" : kpis.departedPastMonth.toString(),
      description: undefined,
      icon: Ship,
    },
    {
      label: t("containers.stats.departedPast90Days"),
      value: kpiQuery.isLoading ? "…" : kpis.departedPast90Days.toString(),
      description: undefined,
      icon: CalendarClock,
    },
    {
      label: t("containers.stats.departedPastYear"),
      value: kpiQuery.isLoading ? "…" : kpis.departedPastYear.toString(),
      description: undefined,
      icon: CalendarRange,
    },
  ];

  const tableColumns: DataTableColumn<ContainerRecord>[] = [
    {
      id: "id",
      label: t("containers.columns.id"),
      cellClassName: "font-mono text-xs",
      renderCell: (container) => formatContainerId(container.id),
    },
    {
      id: "container",
      label: t("containers.columns.container"),
      sortField: "name",
      cellClassName: "font-medium",
      renderCell: (container) => container.name,
    },
    {
      id: "containerNumber",
      label: t("containers.columns.containerNumber"),
      cellClassName: "font-mono text-xs",
      renderCell: (container) => container.containerNumber || t("common.empty.dash"),
    },
    {
      id: "booking",
      label: t("containers.columns.booking"),
      renderCell: (container) => container.booking,
    },
    {
      id: "sealNumber",
      label: t("containers.columns.sealNumber"),
      renderCell: (container) => container.sealNumber || t("common.empty.dash"),
    },
    {
      id: "broker",
      label: t("containers.columns.broker"),
      renderCell: (container) => container.broker || t("common.empty.dash"),
    },
    {
      id: "company",
      label: t("containers.columns.company"),
      renderCell: (container) => container.company || t("common.empty.dash"),
    },
    {
      id: "cost",
      label: t("containers.columns.cost"),
      renderCell: (container) => formatOptionalContainerCost(container.cost),
    },
    {
      id: "departureDate",
      label: t("containers.columns.departureDate"),
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatContainerDate(container.departureDate),
    },
    {
      id: "arrivalDate",
      label: t("containers.columns.arrivalDate"),
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatContainerDate(container.arrivalDate),
    },
    {
      id: "barcodeSequence",
      label: t("containers.columns.barcodeSequence"),
      defaultVisible: false,
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (container) => (container.barcodeSequence > 0 ? container.barcodeSequence : t("common.empty.dash")),
    },
    {
      id: "createdAt",
      label: t("common.audit.dateCreated"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDateTime(container.createdAt),
    },
    {
      id: "updatedAt",
      label: t("common.audit.dateModified"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (container) => formatAuditDateTime(container.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("containers-v2", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, containerFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const noun = t("containers.noun");
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalContainers,
      catalogTotal: stats.total,
      noun,
      isLoading: isFetching && containers.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  return (
    <div>
      <PageHeader
        title={t("containers.title")}
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            {t("containers.actions.add")}
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
                placeholder={t("containers.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={t("common.pagination.showingOf", {
                  count: containers.length,
                  total: totalContainers,
                  noun,
                })}
                presets={{
                  storageKey: "containers",
                  rows: filters.rows,
                  fields: containerFilterFields,
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
                  fields={containerFilterFields}
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
          pageRowIds={containers.map((container) => String(container.id))}
          totalCount={totalContainers}
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
            {toErrorMessage(error)}
          </div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Container}
            title={t("containers.loading.title")}
            description={t("containers.loading.description")}
            columns={[
              t("containers.columns.container"),
              t("containers.columns.status"),
              t("containers.columns.departureDate"),
              t("containers.columns.capacity"),
              t("containers.columns.cost"),
            ]}
          />
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
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds.map(String)}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id, checked) => toggleSelect(Number(id), checked)}
            onRowClick={setViewContainer}
            onRowDoubleClick={openEditForm}
            activeRowId={viewContainer ? String(viewContainer.id) : undefined}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("containers.empty.noMatch") : t("containers.empty.none")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("containers.actions.add")}
                </Button>
              </>
            }
          />
        )}

        {!isLoading && !isError ? (
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.pagination.showingOf", {
              count: containers.length,
              total: totalContainers,
              noun,
            })}
          </p>
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {formMode === "edit" ? t("containers.form.editTitle") : t("containers.form.addTitle")}
            </DialogTitle>
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
            submitLabel={
              formMode === "edit" ? t("common.actions.saveChanges") : t("containers.actions.add")
            }
            externalError={formError}
            onSubmit={saveContainer}
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
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("containers.dialogs.deleteTitlePlural")
                : t("containers.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("containers.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("containers.dialogs.deleteOne", {
                    name: deleteTarget?.name ?? "",
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
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
