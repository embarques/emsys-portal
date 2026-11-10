"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { CatalogBulkDeleteDialog } from "@/components/app-shell/catalog-bulk-delete-dialog";
import { CatalogDataTable, CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { DirectoryTableRowActions } from "@/components/app-shell/directory-table-row-actions";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { PredefinedRouteDialog } from "@/components/predefined-routes/predefined-route-dialog";
import { PredefinedRouteCoverageCell } from "@/components/predefined-routes/predefined-route-coverage-cell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { fetchPredefinedRoutesPage } from "@/lib/predefined-routes/api/predefined-routes-api";
import { PREDEFINED_ROUTE_TABLE_FILTER_FIELDS } from "@/lib/predefined-routes/filter-fields";
import { usePredefinedRouteWorkspace } from "@/lib/predefined-routes/hooks/use-predefined-route-workspace";
import type { PredefinedRoute } from "@/lib/predefined-routes/types";
import { parseRouteCities } from "@/lib/predefined-routes/utils/route-cities";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isRouteZipCode } from "@/lib/orders/predefined-route-filter";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogBulkDelete } from "@/lib/table/hooks/use-catalog-bulk-delete";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import type { DataTableColumn } from "@/lib/table/types";

const routeRowId = (item: PredefinedRoute) => String(item.id);

export function PredefinedRoutesWorkspace() {
  const { t } = useTranslation();
  const state = usePredefinedRouteWorkspace();
  const { companyId, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.predefinedRoutesCreate.name, PERMISSIONS.predefinedRoutesCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.predefinedRoutesUpdate.name, PERMISSIONS.predefinedRoutesUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.predefinedRoutesDelete.name, PERMISSIONS.predefinedRoutesDelete.resourceType);
  const table = useCatalogTable({
    fields: PREDEFINED_ROUTE_TABLE_FILTER_FIELDS,
    keepPrevious: false,
    enabled: Boolean(companyId) && hasPermission(PERMISSIONS.predefinedRoutesView.name, PERMISSIONS.predefinedRoutesView.resourceType),
    keyPrefix: "predefinedRoutes.filters.fields",
    defaultSort: "name:asc",
    getRowId: routeRowId,
    queryKey: (params) => [...queryKeys.predefinedRoutes.page(params), companyId],
    fetchPage: fetchPredefinedRoutesPage,
  });
  const bulkDelete = useCatalogBulkDelete({
    getId: routeRowId,
    deleteOne: state.deleteRecord,
    entityLabel: t("predefinedRoutes.entity"),
    onDeleted: (ids) => table.selection.setSelectedIds((current) => current.filter((id) => !ids.includes(id))),
  });

  const columns = useMemo<DataTableColumn<PredefinedRoute>[]>(() => [
    { id: "id", label: t("common.apiColumns.id"), defaultWidth: 96, cellClassName: "tabular-nums", renderCell: (item) => item.id },
    { id: "name", label: t("predefinedRoutes.fields.name"), cellClassName: "font-medium", renderCell: (item) => item.name },
    {
      id: "cities",
      label: t("predefinedRoutes.fields.cities"),
      sortable: false,
      copyable: false,
      defaultWidth: 280,
      renderCell: (item) => <PredefinedRouteCoverageCell entries={parseRouteCities(item.content).filter((entry) => !isRouteZipCode(entry))} />,
    },
    {
      id: "zipcodes",
      label: t("predefinedRoutes.fields.zipcodes"),
      sortable: false,
      copyable: false,
      defaultWidth: 240,
      renderCell: (item) => <PredefinedRouteCoverageCell entries={parseRouteCities(item.content).filter(isRouteZipCode)} />,
    },
  ], [t]);
  const columnLayout = useColumnVisibility("predefined-routes-catalog-v1", columns);
  const { selectedIds, selectedRows } = table.selection;

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("predefinedRoutes.title")}
        description={t("predefinedRoutes.description")}
        actions={
          <Button disabled={!canCreate} onClick={() => state.edit(null)}>
            <Plus className="size-4" />
            {t("predefinedRoutes.add")}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <CatalogTableToolbar
            state={table}
            presetScope="predefined-routes"
            searchPlaceholder={t("predefinedRoutes.searchPlaceholder")}
            columnLayout={columnLayout}
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={table.selection.pageRowIds}
          totalCount={table.total}
          onSelectedIdsChange={table.selection.setSelectedIds}
          canEdit={canUpdate}
          canDelete={canDelete}
          editDisabled={state.busy}
          deleteDisabled={state.busy || bulkDelete.isPending}
          onEdit={() => { if (selectedRows[0]) state.edit(selectedRows[0]); }}
          onDelete={() => bulkDelete.request(selectedRows)}
        />

        <CatalogDataTable
          state={table}
          columns={columnLayout.columns}
          columnLayout={columnLayout}
          rowKey={routeRowId}
          rowLabel={(item) => item.name}
          emptyMessage={t("predefinedRoutes.empty")}
          retryLabel={t("predefinedRoutes.retry")}
          onRowDoubleClick={canUpdate ? (item) => state.edit(item) : undefined}
          renderSelectCellActions={(item) => (
            <DirectoryTableRowActions
              row={item}
              onEdit={(row) => state.edit(row)}
              onDelete={(row) => void state.remove(row)}
              editDisabled={state.busy || !canUpdate}
              deleteDisabled={state.busy || !canDelete}
            />
          )}
        />
        <CatalogTablePagination state={table} />
      </Card>

      <PredefinedRouteDialog state={state} />
      <CatalogBulkDeleteDialog state={bulkDelete} entity={t("predefinedRoutes.entity")} entities={t("predefinedRoutes.entities")} getName={(item) => item.name} />
    </div>
  );
}
