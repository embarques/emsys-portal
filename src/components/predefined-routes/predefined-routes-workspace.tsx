"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";

import { CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { PageHeader } from "@/components/app-shell/page-header";
import { PredefinedRouteDialog } from "@/components/predefined-routes/predefined-route-dialog";
import { PredefinedRouteCoverageCell } from "@/components/predefined-routes/predefined-route-coverage-cell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
import { getPrimarySortSpec } from "@/lib/api/list-query";
import { useTranslation } from "@/lib/i18n";
import { fetchPredefinedRoutesPage } from "@/lib/predefined-routes/api/predefined-routes-api";
import { PREDEFINED_ROUTE_TABLE_FILTER_FIELDS } from "@/lib/predefined-routes/filter-fields";
import { usePredefinedRouteWorkspace } from "@/lib/predefined-routes/hooks/use-predefined-route-workspace";
import { parseRouteCities } from "@/lib/predefined-routes/utils/route-cities";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isRouteZipCode } from "@/lib/orders/predefined-route-filter";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import { useTableSort } from "@/lib/table/use-table-sort";

function SortableHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (field: string) => void;
}) {
  const { t } = useTranslation();
  const active = getPrimarySortSpec(sort);
  const direction = active?.field === field ? active.direction : undefined;

  return (
    <th
      className="px-4 py-3 font-medium"
      aria-sort={direction === "desc" ? "descending" : direction === "asc" ? "ascending" : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={t("common.table.sortBy", { column: label })}
        className="group/sort flex items-center gap-0.5 text-left"
      >
        {label}
        {direction === "desc" ? (
          <ChevronDown className="size-3.5 shrink-0 text-foreground/80" />
        ) : direction === "asc" ? (
          <ChevronUp className="size-3.5 shrink-0 text-foreground/80" />
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/30 opacity-0 transition-opacity group-hover/sort:opacity-100" />
        )}
      </button>
    </th>
  );
}

export function PredefinedRoutesWorkspace() {
  const { t } = useTranslation();
  const state = usePredefinedRouteWorkspace();
  const { companyId, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.predefinedRoutesCreate.name, PERMISSIONS.predefinedRoutesCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.predefinedRoutesUpdate.name, PERMISSIONS.predefinedRoutesUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.predefinedRoutesDelete.name, PERMISSIONS.predefinedRoutesDelete.resourceType);
  const { sort, onSortChange } = useTableSort("name:asc");
  const table = useCatalogTable({
    fields: PREDEFINED_ROUTE_TABLE_FILTER_FIELDS,
    keepPrevious: false,
    enabled: Boolean(companyId) && hasPermission(PERMISSIONS.predefinedRoutesView.name, PERMISSIONS.predefinedRoutesView.resourceType),
    keyPrefix: "predefinedRoutes.filters.fields",
    sort,
    queryKey: (params) => [...queryKeys.predefinedRoutes.page(params), companyId],
    fetchPage: fetchPredefinedRoutesPage,
  });

  function toggleSort(field: string) {
    const active = getPrimarySortSpec(sort);
    onSortChange(field, active?.field === field && active.direction === "asc" ? "desc" : "asc");
    table.pagination.setPage(1);
  }

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
          />
        </CardHeader>

        {table.isLoading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : table.isError ? (
          <div className="space-y-3 border-b px-6 py-3">
            <p role="alert" className="text-sm text-destructive">
              {normalizeApiError(table.error).message}
            </p>
            <Button variant="outline" onClick={() => void table.refetch()}>
              {t("predefinedRoutes.retry")}
            </Button>
          </div>
        ) : !table.items.length ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            {table.hasActiveFilters ? t("common.table.noMatches") : t("predefinedRoutes.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <SortableHeader label={t("common.apiColumns.id")} field="id" sort={sort} onSort={toggleSort} />
                  <SortableHeader label={t("predefinedRoutes.fields.name")} field="name" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">{t("predefinedRoutes.fields.cities")}</th>
                  <th className="px-4 py-3 font-medium">{t("predefinedRoutes.fields.zipcodes")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("common.actions.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {table.items.map((item) => {
                  const cities = parseRouteCities(item.content);
                  return (
                    <tr key={item.id} className="border-b align-top last:border-0">
                      <td className="px-4 py-3 tabular-nums">{item.id}</td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      {[cities.filter((entry) => !isRouteZipCode(entry)), cities.filter(isRouteZipCode)].map((entries, index) => (
                        <td key={index} className="px-4 py-3">
                          <PredefinedRouteCoverageCell entries={entries} />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy || !canUpdate}
                            onClick={() => state.edit(item)}
                            aria-label={t("predefinedRoutes.editNamed", { name: item.name })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy || !canDelete}
                            onClick={() => void state.remove(item)}
                            aria-label={t("predefinedRoutes.deleteNamed", { name: item.name })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!table.isLoading && !table.isError ? <CatalogTablePagination state={table} /> : null}
      </Card>

      <PredefinedRouteDialog state={state} />
    </div>
  );
}
