"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PackageCheck, Printer } from "lucide-react";

import {
  CatalogDataTable,
  CatalogTablePagination,
  CatalogTableToolbar,
} from "@/components/app-shell/catalog-table-toolbar";
import { RouteWorklist } from "@/components/pickup-delivery-routes/route-worklist";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  TableSelectionActionsMenu,
  TableSelectionActionItem,
} from "@/components/app-shell/table-selection-actions-menu";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
import { DeliverDialog } from "@/components/deliveries/deliver-dialog";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { DeliveryMobileRow } from "@/components/deliveries/delivery-mobile-row";
import { DeliveryViewSheet } from "@/components/deliveries/delivery-view-sheet";
import { TablePhoneCell } from "@/components/phones/table-phone-cell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
import { formatBarcodeDeliveryRoute } from "@/lib/barcodes/display";
import { fetchAssignedDeliveryBarcodesPage } from "@/lib/deliveries/api/assigned-deliveries-api";
import { ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS } from "@/lib/deliveries/filter-fields";
import { useDeliveryAccess } from "@/lib/deliveries/hooks/use-deliver-invoice";
import {
  DEFAULT_ASSIGNED_DELIVERY_SORT,
  formatDeliveryAddress,
  formatDeliveryRate,
  type AssignedDeliveryBarcode,
} from "@/lib/deliveries/types";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import { tableSelectionActionMenuStyles, tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

function rowKey(row: AssignedDeliveryBarcode) {
  return row.barcodeId || (row.id > 0 ? String(row.id) : `${row.invoiceId}:${row.number}`);
}

export function DeliveriesWorkspace() {
  const access = useDeliveryAccess();
  return (
    <RouteWorklist
      canViewOthers={access.canList && access.viewScope === "all"}
      routeType="delivery"
      key={`${access.companyId}:${access.actorId}:${access.viewScope}:${access.canDeliver}:${access.canPrint}`}
    >
      {(work) => (
        <RouteDeliveriesTable
          access={access}
          routeEmployee={work.routeEmployee}
          scopedRouteId={work.scopedRouteId}
          scopeKey={work.scopeKey}
          scopeFilter={work.scopeFilter}
          hasScopeFilter={work.hasScopeFilter}
          clearScopeFilter={work.clearScopeFilter}
        />
      )}
    </RouteWorklist>
  );
}

function RouteDeliveriesTable({
  access,
  routeEmployee,
  scopedRouteId,
  scopeKey,
  scopeFilter,
  hasScopeFilter,
  clearScopeFilter,
}: {
  routeEmployee: string | null;
  scopedRouteId: string | null;
  scopeKey: string;
  access: ReturnType<typeof useDeliveryAccess>;
  scopeFilter: ReactNode;
  hasScopeFilter: boolean;
  clearScopeFilter: () => void;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const [printRow, setPrintRow] = useState<AssignedDeliveryBarcode | null>(null);
  const [deliverRow, setDeliverRow] = useState<AssignedDeliveryBarcode | null>(null);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const table = useCatalogTable({
    fields: ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS,
    keepPrevious: false,
    enabled: access.canList,
    keyPrefix: "deliveries.filters.fields",
    defaultSort: DEFAULT_ASSIGNED_DELIVERY_SORT,
    getRowId: rowKey,
    selectionResetKey: scopeKey,
    queryKey: (params) => [
      ...queryKeys.deliveries.assignedPage(access.companyId, access.actorId, params),
      access.viewScope,
      scopeKey,
    ],
    fetchPage: (params, signal) =>
      fetchAssignedDeliveryBarcodesPage(params, signal, { routeEmployee, scopedRouteId }),
  });
  const { sort } = table;
  const { selectedIds, selectedRows } = table.selection;

  const columns = useMemo<DataTableColumn<AssignedDeliveryBarcode>[]>(
    () => [
      {
        id: "barcode",
        label: t("deliveries.columns.barcode"),
        sortField: "number",
        cellClassName: "font-medium tabular-nums",
        renderCell: (row) => row.number || dash,
      },
      {
        id: "invoice",
        label: t("deliveries.columns.invoice"),
        sortField: "invoice.number",
        renderCell: (row) => row.invoiceNumber || dash,
      },
      {
        id: "invoiceBalance",
        label: t("deliveries.columns.invoiceBalance"),
        sortField: "invoice.balance",
        renderCell: (row) => <DeliveryRowBalance row={row} />,
      },
      {
        id: "rate",
        label: t("deliveries.columns.rate"),
        sortField: "route.rate",
        cellClassName: "tabular-nums",
        renderCell: (row) => formatDeliveryRate(row.routeRate),
      },
      {
        id: "name",
        label: t("deliveries.columns.name"),
        sortField: "name",
        renderCell: (row) => row.description || dash,
      },
      {
        id: "container",
        label: t("deliveries.columns.container"),
        sortField: "container.name",
        renderCell: (row) => row.container?.name || dash,
      },
      {
        id: "route",
        label: t("deliveries.columns.route"),
        sortField: "route.name",
        renderCell: (row) => formatBarcodeDeliveryRoute(row.route, t),
      },
      {
        id: "senderName",
        label: t("deliveries.columns.senderName"),
        sortField: "sender.name",
        renderCell: (row) => row.sender?.name || dash,
      },
      {
        id: "senderPhones",
        label: t("deliveries.columns.senderPhones"),
        sortField: "sender.phones.number",
        cellClassName: "min-w-[260px]",
        truncateCell: false,
        renderCell: (row) => <TablePhoneCell phones={row.sender?.phones ?? []} callable />,
      },
      {
        id: "receiverName",
        label: t("deliveries.columns.receiverName"),
        sortField: "receiver.name",
        renderCell: (row) => row.receiver?.name || dash,
      },
      {
        id: "address",
        label: t("deliveries.columns.address"),
        sortField: "receiver.address.address1",
        truncateCell: false,
        renderCell: (row) => formatDeliveryAddress(row.receiver) || dash,
      },
      {
        id: "city",
        label: t("deliveries.columns.city"),
        sortField: "receiver.address.city",
        renderCell: (row) => row.receiver?.city || dash,
      },
      {
        id: "phones",
        label: t("deliveries.columns.phones"),
        sortField: "receiver.phones.number",
        cellClassName: "min-w-[260px]",
        truncateCell: false,
        renderCell: (row) => <TablePhoneCell phones={row.receiver?.phones ?? []} callable />,
      },
    ],
    [dash, t],
  );
  const columnLayout = useColumnVisibility("deliveries-assigned-v1", columns);

  const viewRow = viewKey ? table.items.find((row) => rowKey(row) === viewKey) ?? null : null;
  const selectedRow = selectedRows.length === 1 ? selectedRows[0]! : null;
  const selectedActionDisabled = !selectedRow?.invoiceId || !selectedRow.delivery?.id;

  function openRow(row: AssignedDeliveryBarcode) {
    setViewKey(rowKey(row));
    setViewOpen(true);
  }

  function openFromView(open: (row: AssignedDeliveryBarcode) => void, row: AssignedDeliveryBarcode) {
    setViewOpen(false);
    open(row);
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader title={t("deliveries.title")} description={t("deliveries.description")} />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <CatalogTableToolbar
            state={table}
            presetScope="deliveries"
            searchPlaceholder={t("deliveries.searchPlaceholder")}
            columnLayout={columnLayout}
            filterExtras={scopeFilter}
            extraActiveFilterCount={hasScopeFilter ? 1 : 0}
            onExtraClear={clearScopeFilter}
          />
        </CardHeader>

        {!access.canList ? (
          <p role="alert" className="border-b px-6 py-3 text-sm text-muted-foreground">
            {t("deliveries.noAccess")}
          </p>
        ) : (
          <>
            <ul className="md:hidden" aria-label={t("deliveries.title")}>
              {table.isLoading ? (
                <li className="px-6 py-12 text-center text-sm text-muted-foreground">{t("common.loading")}</li>
              ) : table.isError ? (
                <li className="space-y-3 border-b px-6 py-3">
                  <p role="alert" className="text-sm text-destructive">
                    {normalizeApiError(table.error).message}
                  </p>
                  <Button variant="outline" onClick={() => void table.refetch()}>
                    {t("deliveries.retry")}
                  </Button>
                </li>
              ) : !table.items.length ? (
                <li className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {table.hasActiveFilters ? t("common.table.noMatches") : t("deliveries.empty")}
                </li>
              ) : (
                table.items.map((row, index) => {
                  const city = row.receiver?.city || t("deliveries.noCity");
                  const previous =
                    index > 0 ? table.items[index - 1]!.receiver?.city || t("deliveries.noCity") : null;
                  return (
                    <li key={rowKey(row)}>
                      {sort.startsWith("receiver.address.city:") && city !== previous ? (
                        <h3 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {city}
                        </h3>
                      ) : null}
                      <DeliveryMobileRow
                        row={row}
                        canDeliver={access.canDeliver}
                        onDeliver={setDeliverRow}
                        canPrint={access.canPrint}
                        onPrint={setPrintRow}
                      />
                    </li>
                  );
                })
              )}
            </ul>

            <div className="hidden md:block">
              <TableSelectionToolbar
                selectedIds={selectedIds}
                pageRowIds={table.selection.pageRowIds}
                totalCount={table.total}
                onSelectedIdsChange={table.selection.setSelectedIds}
                actions={
                  access.canDeliver || access.canPrint ? (
                    <>
                      {access.canPrint ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                          disabled={!selectedRow?.invoiceId}
                          onClick={() => {
                            if (selectedRow) setPrintRow(selectedRow);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                          {t("invoices.printSignatures.action")}
                        </Button>
                      ) : null}
                      <TableSelectionActionsMenu hidden={!access.canDeliver}>
                        <TableSelectionActionItem
                          disabled={selectedActionDisabled}
                          onSelect={() => {
                            if (selectedRow) setDeliverRow(selectedRow);
                          }}
                          className={tableSelectionActionMenuStyles.deliver}
                        >
                          <PackageCheck className="size-4" />
                          {t("deliveries.deliver.action")}
                        </TableSelectionActionItem>
                      </TableSelectionActionsMenu>
                    </>
                  ) : undefined
                }
              />
              <CatalogDataTable
                state={table}
                columns={columnLayout.columns}
                columnLayout={columnLayout}
                rowKey={rowKey}
                rowLabel={(row) => row.number || rowKey(row)}
                emptyMessage={t("deliveries.empty")}
                retryLabel={t("deliveries.retry")}
                minWidth={1400}
                onRowClick={openRow}
                activeRowId={viewKey ?? undefined}
              />
            </div>
          </>
        )}
        {access.canList && !table.isLoading && !table.isError ? <CatalogTablePagination state={table} /> : null}
      </Card>

      <DeliveryViewSheet
        row={viewRow}
        open={viewOpen && Boolean(viewRow)}
        onOpenChange={setViewOpen}
        canDeliver={access.canDeliver}
        canPrint={access.canPrint}
        onDeliver={(row) => openFromView(setDeliverRow, row)}
        onPrint={(row) => openFromView(setPrintRow, row)}
      />
      {printRow?.invoiceId && access.canPrint && (
        <InvoicePrintSignaturesDialog
          key={`${access.companyId}:${printRow.invoiceId}:${printRow.delivery?.id}`}
          invoiceIds={[printRow.invoiceId]}
          trip={printRow.delivery?.id ? { deliveryId: String(printRow.delivery.id) } : undefined}
          onClose={() => setPrintRow(null)}
        />
      )}
      {deliverRow && access.canDeliver && (
        <DeliverDialog
          key={`${access.companyId}:${access.actorId}:${deliverRow.invoiceId}:${deliverRow.route?.id}:${deliverRow.delivery?.id}`}
          target={deliverRow}
          onClose={() => setDeliverRow(null)}
          onDelivered={() => {
            setDeliverRow(null);
            setViewKey(null);
            table.selection.setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}
