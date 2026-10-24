"use client";

import { useState } from "react";
import { PackageCheck, Printer } from "lucide-react";

import { CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { InteractiveTableRow } from "@/components/app-shell/interactive-table-row";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
import { DeliverDialog } from "@/components/deliveries/deliver-dialog";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { DeliveryMobileRow } from "@/components/deliveries/delivery-mobile-row";
import { DeliveryViewSheet } from "@/components/deliveries/delivery-view-sheet";
import { TablePhoneCell } from "@/components/phones/table-phone-cell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
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

function rowKey(row: AssignedDeliveryBarcode) {
  return row.barcodeId || (row.id > 0 ? String(row.id) : `${row.invoiceId}:${row.number}`);
}

export function DeliveriesWorkspace() {
  const { t } = useTranslation();
  const access = useDeliveryAccess();
  const [printRow, setPrintRow] = useState<AssignedDeliveryBarcode | null>(null);
  const [deliverRow, setDeliverRow] = useState<AssignedDeliveryBarcode | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const table = useCatalogTable({
    fields: ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS,
    keepPrevious: false,
    enabled: access.canList,
    keyPrefix: "deliveries.filters.fields",
    sort: DEFAULT_ASSIGNED_DELIVERY_SORT,
    queryKey: (params) => queryKeys.deliveries.assignedPage(access.companyId, access.actorId, params),
    fetchPage: fetchAssignedDeliveryBarcodesPage,
  });

  const headers = [
    t("deliveries.columns.barcode"),
    t("deliveries.columns.invoice"),
    t("deliveries.columns.invoiceBalance"),
    t("deliveries.columns.rate"),
    t("deliveries.columns.name"),
    t("deliveries.columns.container"),
    t("deliveries.columns.senderName"),
    t("deliveries.columns.senderPhones"),
    t("deliveries.columns.receiverName"),
    t("deliveries.columns.address"),
    t("deliveries.columns.province"),
    t("deliveries.columns.phones"),
  ];

  const selectedRow = selectedKey ? table.items.find((row) => rowKey(row) === selectedKey) ?? null : null;
  const selectedActionDisabled = !selectedRow?.invoiceId || !selectedRow.delivery?.id;

  function openRow(row: AssignedDeliveryBarcode) {
    setSelectedKey(rowKey(row));
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
              const province = row.receiver?.province || t("deliveries.noProvince");
              const previous = index > 0 ? table.items[index - 1]!.receiver?.province || t("deliveries.noProvince") : null;
              return (
                <li key={rowKey(row)}>
                  {province !== previous ? (
                    <h3 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{province}</h3>
                  ) : null}
                  <DeliveryMobileRow row={row} canDeliver={access.canDeliver} onDeliver={setDeliverRow} canPrint={access.canPrint} onPrint={setPrintRow} />
                </li>
              );
            })}
          </ul>
          {selectedRow && (access.canDeliver || access.canPrint) ? (
            <TableSelectionBar
              className="hidden md:flex"
              selectedCount={1}
              totalCount={table.items.length}
              onClear={() => setSelectedKey(null)}
              actions={<>
                {access.canDeliver ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
                    disabled={selectedActionDisabled}
                    onClick={() => setDeliverRow(selectedRow)}
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
                    disabled={selectedActionDisabled}
                    onClick={() => setPrintRow(selectedRow)}
                  >
                    <Printer className="h-4 w-4" />
                    {t("invoices.printSignatures.action")}
                  </Button>
                ) : null}
              </>}
            />
          ) : null}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  {headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-medium">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.items.map((row) => {
                  const key = rowKey(row);
                  return (
                    <InteractiveTableRow
                      key={key}
                      className="align-top"
                      active={key === selectedKey}
                      aria-selected={key === selectedKey}
                      tabIndex={0}
                      onRowClick={() => openRow(row)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                        event.preventDefault();
                        openRow(row);
                      }}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{row.number}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.invoiceNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <DeliveryRowBalance row={row} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDeliveryRate(row.routeRate)}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.container?.name}</td>
                      <td className="px-4 py-3">{row.sender?.name}</td>
                      <td className="min-w-[260px] px-4 py-3">
                        <TablePhoneCell phones={row.sender?.phones ?? []} callable />
                      </td>
                      <td className="px-4 py-3">{row.receiver?.name}</td>
                      <td className="px-4 py-3">{formatDeliveryAddress(row.receiver)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.receiver?.province}</td>
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
        row={selectedRow}
        open={viewOpen && Boolean(selectedRow)}
        onOpenChange={setViewOpen}
        canDeliver={access.canDeliver}
        canPrint={access.canPrint}
        onDeliver={(row) => openFromView(setDeliverRow, row)}
        onPrint={(row) => openFromView(setPrintRow, row)}
      />
      {printRow?.invoiceId && printRow.delivery?.id && access.canPrint && <InvoicePrintSignaturesDialog key={`${access.companyId}:${printRow.invoiceId}:${printRow.delivery.id}`} invoiceIds={[printRow.invoiceId]} trip={{ deliveryId: String(printRow.delivery.id) }} onClose={() => setPrintRow(null)} />}
      {deliverRow && access.canDeliver && <DeliverDialog
        key={`${access.companyId}:${access.actorId}:${deliverRow.invoiceId}:${deliverRow.route?.id}:${deliverRow.delivery?.id}`}
        target={deliverRow}
        onClose={() => setDeliverRow(null)}
        onDelivered={() => {
          setDeliverRow(null);
          setSelectedKey(null);
        }}
      />}
    </div>
  );
}
