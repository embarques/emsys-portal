"use client";
import { useMemo } from "react";
import { formatAuditDateTime } from "@/lib/audit/display";
import { Plus } from "lucide-react";
import { EmployeeTitleDialog } from "@/components/employee-titles/employee-title-dialog";
import { CatalogBulkDeleteDialog } from "@/components/app-shell/catalog-bulk-delete-dialog";
import { CatalogDataTable, CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { DirectoryTableRowActions } from "@/components/app-shell/directory-table-row-actions";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { fetchEmployeeTitlesPage } from "@/lib/employee-titles/api/employee-titles-api";
import { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";
import type { EmployeeTitle } from "@/lib/employee-titles/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogBulkDelete } from "@/lib/table/hooks/use-catalog-bulk-delete";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import { NAMED_CATALOG_TABLE_FILTER_FIELDS } from "@/lib/table/named-catalog-filter-fields";
import type { DataTableColumn } from "@/lib/table/types";

function localizeTitleFilterOption(field: string, option: { value: string; label: string }, t: (key: string) => string) {
  return field === "active"
    ? { ...option, label: t(option.value === "true" ? "employeeTitles.active" : "employeeTitles.inactive") }
    : option;
}

const titleRowId = (item: EmployeeTitle) => String(item.id);

export function EmployeeTitlesWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.employeeTitlesUpdate.name, PERMISSIONS.employeeTitlesUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.employeeTitlesDelete.name, PERMISSIONS.employeeTitlesDelete.resourceType);
  const state = useTitleWorkspace();
  const table = useCatalogTable({
    fields: NAMED_CATALOG_TABLE_FILTER_FIELDS,
    keyPrefix: "employeeTitles.filters.fields",
    defaultSort: "name:asc",
    getRowId: titleRowId,
    queryKey: queryKeys.employeeTitles.page,
    fetchPage: fetchEmployeeTitlesPage,
    localizeOption: localizeTitleFilterOption,
  });
  const bulkDelete = useCatalogBulkDelete({
    getId: titleRowId,
    deleteOne: state.deleteRecord,
    entityLabel: t("employeeTitles.entity"),
    onDeleted: (ids) => table.selection.setSelectedIds((current) => current.filter((id) => !ids.includes(id))),
  });

  const columns = useMemo<DataTableColumn<EmployeeTitle>[]>(() => [
    { id: "id", label: t("common.apiColumns.id"), defaultWidth: 96, cellClassName: "tabular-nums", renderCell: (item) => item.id },
    { id: "name", label: t("employeeTitles.name"), cellClassName: "font-medium", renderCell: (item) => item.name },
    { id: "active", label: t("employeeTitles.active"), renderCell: (item) => t(item.active ? "employeeTitles.active" : "employeeTitles.inactive") },
    { id: "createdAt", label: t("common.apiColumns.createdAt"), renderCell: (item) => (item.createdAt ? formatAuditDateTime(item.createdAt) : dash) },
    { id: "updatedAt", label: t("common.apiColumns.updatedAt"), renderCell: (item) => (item.updatedAt ? formatAuditDateTime(item.updatedAt) : dash) },
  ], [dash, t]);
  const columnLayout = useColumnVisibility("employee-titles-catalog-v1", columns);
  const { selectedIds, selectedRows } = table.selection;

  return <div className="max-w-full overflow-x-hidden">
    <PageHeader title={t("employeeTitles.title")} description={t("employeeTitles.description")} actions={
      <PermissionGuard permission={PERMISSIONS.employeeTitlesCreate}>
        <Button onClick={() => state.edit(null)}><Plus className="size-4" />{t("employeeTitles.add")}</Button>
      </PermissionGuard>
    } />
    <Card className="mt-6 gap-0">
      <CardHeader className="gap-3 border-b py-4 pb-3">
        <CatalogTableToolbar state={table} presetScope="employee-titles" searchPlaceholder={t("employeeTitles.searchPlaceholder")} columnLayout={columnLayout} />
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
        rowKey={titleRowId}
        rowLabel={(item) => item.name}
        emptyMessage={t("employeeTitles.empty")}
        retryLabel={t("employeeTitles.retry")}
        onRowDoubleClick={canUpdate ? (item) => state.edit(item) : undefined}
        renderSelectCellActions={(item) => (
          <DirectoryTableRowActions
            row={item}
            onEdit={canUpdate ? (row) => state.edit(row) : undefined}
            onDelete={canDelete ? (row) => void state.remove(row) : undefined}
            editDisabled={state.busy}
            deleteDisabled={state.busy}
          />
        )}
      />
      <CatalogTablePagination state={table} />
    </Card>
    <EmployeeTitleDialog state={state} />
    <CatalogBulkDeleteDialog state={bulkDelete} entity={t("employeeTitles.entity")} entities={t("employeeTitles.entities")} getName={(item) => item.name} />
  </div>;
}
