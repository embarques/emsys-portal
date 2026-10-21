"use client";

import { FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";

import { CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { PageHeader } from "@/components/app-shell/page-header";
import { LegacyRouteDialog } from "@/components/legacy-routes/legacy-route-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { fetchLegacyRoutesPage } from "@/lib/legacy-routes/api/legacy-routes-api";
import { isLegacyRoutesMockEnabled } from "@/lib/legacy-routes/api/legacy-routes-mock";
import { LEGACY_ROUTE_TABLE_FILTER_FIELDS } from "@/lib/legacy-routes/filter-fields";
import { useLegacyRouteWorkspace } from "@/lib/legacy-routes/hooks/use-legacy-route-workspace";
import { parseRouteCities } from "@/lib/legacy-routes/utils/route-cities";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";

export function LegacyRoutesWorkspace() {
  const { t } = useTranslation();
  const state = useLegacyRouteWorkspace();
  const table = useCatalogTable({
    fields: LEGACY_ROUTE_TABLE_FILTER_FIELDS,
    keyPrefix: "legacyRoutes.filters.fields",
    sort: "name:asc",
    queryKey: queryKeys.legacyRoutes.page,
    fetchPage: fetchLegacyRoutesPage,
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("legacyRoutes.title")}
        description={t("legacyRoutes.description")}
        actions={
          <Button onClick={() => state.edit(null)}>
            <Plus className="size-4" />
            {t("legacyRoutes.add")}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          {isLegacyRoutesMockEnabled() ? (
            <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
              <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("legacyRoutes.mockNotice")}
            </p>
          ) : null}
          <CatalogTableToolbar
            state={table}
            presetScope="legacy-routes"
            searchPlaceholder={t("legacyRoutes.searchPlaceholder")}
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
              {t("legacyRoutes.retry")}
            </Button>
          </div>
        ) : !table.items.length ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            {table.hasActiveFilters ? t("common.table.noMatches") : t("legacyRoutes.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("common.apiColumns.id")}</th>
                  <th className="px-4 py-3 font-medium">{t("legacyRoutes.fields.name")}</th>
                  <th className="px-4 py-3 font-medium">{t("legacyRoutes.fields.content")}</th>
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
                      <td className="px-4 py-3">
                        {cities.length ? (
                          <div className="flex max-w-xl flex-wrap gap-1">
                            {cities.map((city) => (
                              <Badge key={city.toLocaleLowerCase()} variant="secondary">
                                {city}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          t("common.empty.dash")
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy}
                            onClick={() => state.edit(item)}
                            aria-label={t("legacyRoutes.editNamed", { name: item.name })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy}
                            onClick={() => void state.remove(item)}
                            aria-label={t("legacyRoutes.deleteNamed", { name: item.name })}
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

      <LegacyRouteDialog state={state} />
    </div>
  );
}
