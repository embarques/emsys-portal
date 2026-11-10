"use client";
import { useMemo } from "react";
import { formatAuditDateTime } from "@/lib/audit/display";
import { Plus } from "lucide-react";
import { EmployeeDepartmentDialog } from "@/components/employee-departments/employee-department-dialog";
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
import { fetchEmployeeDepartmentsPage } from "@/lib/employee-departments/api/employee-departments-api";
import { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";
import type { EmployeeDepartment } from "@/lib/employee-departments/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogBulkDelete } from "@/lib/table/hooks/use-catalog-bulk-delete";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import { NAMED_CATALOG_TABLE_FILTER_FIELDS } from "@/lib/table/named-catalog-filter-fields";
import type { DataTableColumn } from "@/lib/table/types";

function localizeDepartmentFilterOption(field: string, option: { value: string; label: string }, t: (key: string) => string) {
  return field === "active"
    ? { ...option, label: t(option.value === "true" ? "employeeDepartments.active" : "employeeDepartments.inactive") }
    : option;
}

const departmentRowId = (item: EmployeeDepartment) => String(item.id);

export function EmployeeDepartmentsWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.employeeDepartmentsUpdate.name, PERMISSIONS.employeeDepartmentsUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.employeeDepartmentsDelete.name, PERMISSIONS.employeeDepartmentsDelete.resourceType);
  const state = useDepartmentWorkspace();
  const table = useCatalogTable({
    fields: NAMED_CATALOG_TABLE_FILTER_FIELDS,
    keyPrefix: "employeeDepartments.filters.fields",
    defaultSort: "name:asc",
    getRowId: departmentRowId,
    queryKey: queryKeys.employeeDepartments.page,
    fetchPage: fetchEmployeeDepartmentsPage,
    localizeOption: localizeDepartmentFilterOption,
  });
  const bulkDelete = useCatalogBulkDelete({
    getId: departmentRowId,
    deleteOne: state.deleteRecord,
    entityLabel: t("employeeDepartments.entity"),
    onDeleted: (ids) => table.selection.setSelectedIds((current) => current.filter((id) => !ids.includes(id))),
  });

  const columns = useMemo<DataTableColumn<EmployeeDepartment>[]>(() => [
    { id: "id", label: t("common.apiColumns.id"), defaultWidth: 96, cellClassName: "tabular-nums", renderCell: (item) => item.id },
    { id: "name", label: t("employeeDepartments.name"), cellClassName: "font-medium", renderCell: (item) => item.name },
    { id: "active", label: t("employeeDepartments.active"), renderCell: (item) => t(item.active ? "employeeDepartments.active" : "employeeDepartments.inactive") },
    { id: "createdAt", label: t("common.apiColumns.createdAt"), renderCell: (item) => (item.createdAt ? formatAuditDateTime(item.createdAt) : dash) },
    { id: "updatedAt", label: t("common.apiColumns.updatedAt"), renderCell: (item) => (item.updatedAt ? formatAuditDateTime(item.updatedAt) : dash) },
  ], [dash, t]);
  const columnLayout = useColumnVisibility("employee-departments-catalog-v1", columns);
  const { selectedIds, selectedRows } = table.selection;

  return <div className="max-w-full overflow-x-hidden">
    <PageHeader title={t("employeeDepartments.title")} description={t("employeeDepartments.description")} actions={
      <PermissionGuard permission={PERMISSIONS.employeeDepartmentsCreate}>
        <Button onClick={() => state.edit(null)}><Plus className="size-4" />{t("employeeDepartments.add")}</Button>
      </PermissionGuard>
    } />
    <Card className="mt-6 gap-0">
      <CardHeader className="gap-3 border-b py-4 pb-3">
        <CatalogTableToolbar state={table} presetScope="employee-departments" searchPlaceholder={t("employeeDepartments.searchPlaceholder")} columnLayout={columnLayout} />
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
        rowKey={departmentRowId}
        rowLabel={(item) => item.name}
        emptyMessage={t("employeeDepartments.empty")}
        retryLabel={t("employeeDepartments.retry")}
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
    <EmployeeDepartmentDialog state={state} />
    <CatalogBulkDeleteDialog state={bulkDelete} entity={t("employeeDepartments.entity")} entities={t("employeeDepartments.entities")} getName={(item) => item.name} />
  </div>;
}
