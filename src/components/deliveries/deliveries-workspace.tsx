"use client";

import { useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, PackageCheck, Printer } from "lucide-react";

import { CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { InteractiveTableRow } from "@/components/app-shell/interactive-table-row";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
import { DeliverDialog } from "@/components/deliveries/deliver-dialog";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { DeliveryMobileRow } from "@/components/deliveries/delivery-mobile-row";
import { DeliveryViewSheet } from "@/components/deliveries/delivery-view-sheet";
import { TablePhoneCell } from "@/components/phones/table-phone-cell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
import { getPrimarySortSpec } from "@/lib/api/list-query";
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
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

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
      className="whitespace-nowrap px-4 py-3 font-medium"
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

function rowKey(row: AssignedDeliveryBarcode) {
  return row.barcodeId || (row.id > 0 ? String(row.id) : `${row.invoiceId}:${row.number}`);
}

export function DeliveriesWorkspace() {
  const access = useDeliveryAccess();
  return <RouteDeliveriesTable key={`${access.companyId}:${access.actorId}:${access.viewScope}:${access.canDeliver}:${access.canPrint}`} access={access} />;
}

function RouteDeliveriesTable({ access }: { access: ReturnType<typeof useDeliveryAccess> }) {
  const { t } = useTranslation();
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
    queryKey: (params) => [...queryKeys.deliveries.assignedPage(access.companyId, access.actorId, params), access.viewScope],
    fetchPage: fetchAssignedDeliveryBarcodesPage,
  });
  const { sort } = table;
  const { selectedIds, selectedRows } = table.selection;

  const headers: { key: string; sortField?: string }[] = [
    { key: "barcode", sortField: "number" },
    { key: "invoice", sortField: "invoice.number" },
    { key: "invoiceBalance", sortField: "invoice.balance" },
    { key: "rate", sortField: "route.rate" },
    { key: "name", sortField: "name" },
    { key: "container", sortField: "container.name" },
    { key: "route", sortField: "route.name" },
    { key: "senderName", sortField: "sender.name" },
    { key: "senderPhones", sortField: "sender.phones.number" },
    { key: "receiverName", sortField: "receiver.name" },
    { key: "address", sortField: "receiver.address.address1" },
    { key: "city", sortField: "receiver.address.city" },
    { key: "phones", sortField: "receiver.phones.number" },
  ];

  function toggleSort(field: string) {
    const active = getPrimarySortSpec(sort);
    table.onSortChange(field, active?.field === field && active.direction === "asc" ? "desc" : "asc");
  }

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
          />
        </CardHeader>

        {!access.canList ? (
          <p role="alert" className="px-6 py-6 text-sm text-muted-foreground">{t("deliveries.noAccess")}</p>
        ) : table.isLoading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : table.isError ? (
          <div className="space-y-3 border-b px-6 py-3">
            <p role="alert" className="text-sm text-destructive">
              {normalizeApiError(table.error).message}
            </p>
            <Button variant="outline" onClick={() => void table.refetch()}>
              {t("deliveries.retry")}
            </Button>
          </div>
        ) : !table.items.length ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            {table.hasActiveFilters ? t("common.table.noMatches") : t("deliveries.empty")}
          </p>
        ) : (<>
          <ul className="md:hidden" aria-label={t("deliveries.title")}>
            {table.items.map((row, index) => {
              const city = row.receiver?.city || t("deliveries.noCity");
              const previous = index > 0 ? table.items[index - 1]!.receiver?.city || t("deliveries.noCity") : null;
              return (
                <li key={rowKey(row)}>
                  {sort.startsWith("receiver.address.city:") && city !== previous ? (
                    <h3 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{city}</h3>
                  ) : null}
                  <DeliveryMobileRow row={row} canDeliver={access.canDeliver} onDeliver={setDeliverRow} canPrint={access.canPrint} onPrint={setPrintRow} />
                </li>
              );
            })}
          </ul>
          <TableSelectionToolbar
            className="hidden md:flex"
            selectedIds={selectedIds}
            pageRowIds={table.selection.pageRowIds}
            totalCount={table.total}
            onSelectedIdsChange={table.selection.setSelectedIds}
            actions={access.canDeliver || access.canPrint ? <>
              {access.canDeliver ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
                  disabled={selectedActionDisabled}
                  onClick={() => { if (selectedRow) setDeliverRow(selectedRow); }}
                >
                  <PackageCheck className="h-4 w-4" />
                  {t("deliveries.deliver.action")}
                </Button>
              ) : null}
              {access.canPrint ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                  disabled={!selectedRow?.invoiceId}
                  onClick={() => { if (selectedRow) setPrintRow(selectedRow); }}
                >
                  <Printer className="h-4 w-4" />
                  {t("invoices.printSignatures.action")}
                </Button>
              ) : null}
            </> : undefined}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="w-10 py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label={t("tableFields.table.selectAllOnPage")}
                      checked={table.selection.allPageSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = !table.selection.allPageSelected && selectedRows.length > 0;
                      }}
                      onChange={(event) => table.selection.toggleAll(event.target.checked)}
                      className="size-4 rounded border-input"
                    />
                  </th>
                  {headers.map(({ key, sortField }) => {
                    const label = t(`deliveries.columns.${key}`);
                    return sortField ? (
                      <SortableHeader key={key} label={label} field={sortField} sort={sort} onSort={toggleSort} />
                    ) : (
                      <th key={key} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.items.map((row) => {
                  const key = rowKey(row);
                  return (
                    <InteractiveTableRow
                      key={key}
                      className="align-top"
                      active={key === viewKey || selectedIds.includes(key)}
                      aria-selected={selectedIds.includes(key)}
                      tabIndex={0}
                      onRowClick={() => openRow(row)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                        event.preventDefault();
                        openRow(row);
                      }}
                    >
                      <td className="py-3 pl-4 pr-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={t("tableFields.table.selectRow", { row: row.number || key })}
                          checked={selectedIds.includes(key)}
                          onChange={(event) => table.selection.toggle(key, event.target.checked)}
                          className="size-4 rounded border-input"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{row.number}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.invoiceNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <DeliveryRowBalance row={row} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDeliveryRate(row.routeRate)}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.container?.name}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatBarcodeDeliveryRoute(row.route, t)}</td>
                      <td className="px-4 py-3">{row.sender?.name}</td>
                      <td className="min-w-[260px] px-4 py-3">
                        <TablePhoneCell phones={row.sender?.phones ?? []} callable />
                      </td>
                      <td className="px-4 py-3">{row.receiver?.name}</td>
                      <td className="px-4 py-3">{formatDeliveryAddress(row.receiver)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.receiver?.city}</td>
                      <td className="min-w-[260px] px-4 py-3">
                        <TablePhoneCell phones={row.receiver?.phones ?? []} callable />
                      </td>
                    </InteractiveTableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}
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
      {printRow?.invoiceId && access.canPrint && <InvoicePrintSignaturesDialog key={`${access.companyId}:${printRow.invoiceId}:${printRow.delivery?.id}`} invoiceIds={[printRow.invoiceId]} trip={printRow.delivery?.id ? { deliveryId: String(printRow.delivery.id) } : undefined} onClose={() => setPrintRow(null)} />}
      {deliverRow && access.canDeliver && <DeliverDialog
        key={`${access.companyId}:${access.actorId}:${deliverRow.invoiceId}:${deliverRow.route?.id}:${deliverRow.delivery?.id}`}
        target={deliverRow}
        onClose={() => setDeliverRow(null)}
        onDelivered={() => {
          setDeliverRow(null);
          setViewKey(null);
          table.selection.setSelectedIds([]);
        }}
      />}
    </div>
  );
}
