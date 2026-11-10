"use client";

import { useMemo } from "react";
import { formatAuditDateTime } from "@/lib/audit/display";
import { Plus } from "lucide-react";

import { CatalogBulkDeleteDialog } from "@/components/app-shell/catalog-bulk-delete-dialog";
import { CatalogDataTable, CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { DirectoryTableRowActions } from "@/components/app-shell/directory-table-row-actions";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { InvoicePolicyDialog } from "@/components/invoice-policies/invoice-policy-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useInvoicePolicyWorkspace } from "@/lib/invoice-policies/hooks/use-invoice-policy-workspace";
import type { InvoicePolicy } from "@/lib/invoice-policies/types";
import { useTranslation } from "@/lib/i18n";
import { fetchInvoicePoliciesPage } from "@/lib/invoice-policies/api/invoice-policies-api";
import { INVOICE_POLICY_TABLE_FILTER_FIELDS } from "@/lib/invoice-policies/filter-fields";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogBulkDelete } from "@/lib/table/hooks/use-catalog-bulk-delete";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import type { DataTableColumn } from "@/lib/table/types";

function localizePolicyFilterOption(field: string, option: { value: string; label: string }, t: (key: string) => string) {
  return field === "active"
    ? { ...option, label: t(option.value === "true" ? "invoicePolicies.active" : "invoicePolicies.inactive") }
    : option;
}

const policyRowId = (item: InvoicePolicy) => String(item.id);

export function InvoicePoliciesWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.invoicePoliciesUpdate.name, PERMISSIONS.invoicePoliciesUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.invoicePoliciesDelete.name, PERMISSIONS.invoicePoliciesDelete.resourceType);
  const state = useInvoicePolicyWorkspace();
  const table = useCatalogTable({
    fields: INVOICE_POLICY_TABLE_FILTER_FIELDS,
    keyPrefix: "invoicePolicies.filters.fields",
    defaultSort: "sortOrder:asc,title:asc",
    getRowId: policyRowId,
    queryKey: queryKeys.invoicePolicies.page,
    fetchPage: fetchInvoicePoliciesPage,
    localizeOption: localizePolicyFilterOption,
  });
  const bulkDelete = useCatalogBulkDelete({
    getId: policyRowId,
    deleteOne: state.deleteRecord,
    entityLabel: t("invoicePolicies.entity"),
    onDeleted: (ids) => table.selection.setSelectedIds((current) => current.filter((id) => !ids.includes(id))),
  });

  const columns = useMemo<DataTableColumn<InvoicePolicy>[]>(() => [
    { id: "id", label: t("common.apiColumns.id"), defaultWidth: 96, cellClassName: "tabular-nums", renderCell: (item) => item.id },
    { id: "title", label: t("invoicePolicies.fields.title"), cellClassName: "font-medium", renderCell: (item) => item.title },
    { id: "body", label: t("invoicePolicies.fields.body"), defaultVisible: false, truncateCell: true, renderCell: (item) => item.body || dash },
    { id: "sortOrder", label: t("invoicePolicies.fields.sortOrder"), cellClassName: "tabular-nums", renderCell: (item) => item.sortOrder },
    { id: "active", label: t("invoicePolicies.fields.active"), renderCell: (item) => t(item.active ? "invoicePolicies.active" : "invoicePolicies.inactive") },
    { id: "createdAt", label: t("common.apiColumns.createdAt"), renderCell: (item) => (item.createdAt ? formatAuditDateTime(item.createdAt) : dash) },
    { id: "updatedAt", label: t("common.apiColumns.updatedAt"), renderCell: (item) => (item.updatedAt ? formatAuditDateTime(item.updatedAt) : dash) },
  ], [dash, t]);
  const columnLayout = useColumnVisibility("invoice-policies-catalog-v1", columns);
  const { selectedIds, selectedRows } = table.selection;

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("invoicePolicies.title")}
        description={t("invoicePolicies.description")}
        actions={
          <PermissionGuard permission={PERMISSIONS.invoicePoliciesCreate}>
            <Button onClick={() => state.edit(null)}>
              <Plus className="size-4" />
              {t("invoicePolicies.add")}
            </Button>
          </PermissionGuard>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <p className="text-sm text-muted-foreground">{t("invoicePolicies.tableHint")}</p>
          <CatalogTableToolbar
            state={table}
            presetScope="invoice-policies"
            searchPlaceholder={t("invoicePolicies.searchPlaceholder")}
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
          rowKey={policyRowId}
          rowLabel={(item) => item.title}
          emptyMessage={t("invoicePolicies.empty")}
          retryLabel={t("invoicePolicies.retry")}
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

      <InvoicePolicyDialog state={state} />
      <CatalogBulkDeleteDialog state={bulkDelete} entity={t("invoicePolicies.entity")} entities={t("invoicePolicies.entities")} getName={(item) => item.title} />
    </div>
  );
}
