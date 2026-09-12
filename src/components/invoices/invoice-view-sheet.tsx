"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { InvoiceActivitySection } from "@/components/invoices/invoice-activity-section";
import { InvoiceBarcodeStatusSection } from "@/components/invoices/invoice-barcode-status-section";
import { InvoiceCommentsSection } from "@/components/invoices/invoice-comments-section";
import { InvoicePackageTrackerSection } from "@/components/invoices/invoice-package-tracker-section";
import { InvoicePaymentsSection } from "@/components/invoices/invoice-payments-section";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { getBarcodeStatusBadgeClass } from "@/lib/barcodes/display";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatAddressLine, formatPartyPhoneList } from "@/lib/customers/display";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoicePickupAssignmentLabel,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoicePaidStatusBadgeClass,
  getInvoicePaidStatusLabel,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  invoicePickupSourceLabelKey,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  getOrderPartyAddress,
  isInvoiceEmployeePickupSource,
  type Invoice,
  type InvoiceLineItem,
  type InvoicePaymentInput,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceViewSheetProps = {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onAddComment: (invoiceId: string, description: string) => void;
  onRecordPayment: (invoiceId: string, input: InvoicePaymentInput) => void;
};

function PartySection({ title, party }: { title: string; party: Invoice["sender"] }) {
  const { t } = useTranslation();
  const address = getOrderPartyAddress(party);

  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      <p className="text-sm font-medium">{party.name}</p>
      {party.documentId ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("invoices.view.fields.documentId")}: {party.documentId}
        </p>
      ) : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <div className="mt-3">
        <p className="text-xs font-medium text-primary">{t("invoices.view.fields.phones")}</p>
        <p className="mt-1 text-sm leading-relaxed">{formatPartyPhoneList(party.phones)}</p>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-primary">{t("invoices.view.fields.address")}</p>
        <p className="mt-1 text-sm leading-relaxed">
          {address ? formatAddressLine(address) : t("common.empty.dash")}
        </p>
      </div>
    </RecordViewSheetSection>
  );
}

function formatInvoiceDeduction(amount: number): string {
  if (!amount) return formatInvoiceMoney(0);
  return `−${formatInvoiceMoney(Math.abs(amount))}`;
}

function InvoiceTotalCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "balance";
}) {
  const isBalance = tone === "balance";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isBalance ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          isBalance ? "text-primary/80" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base tabular-nums",
          isBalance && "font-bold text-primary",
          tone === "positive" && "font-semibold text-emerald-600 dark:text-emerald-400",
          tone === "default" && "font-semibold text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatBarcodeScanDate(scanDate: string | undefined, empty: string): string {
  if (!scanDate) return empty;
  const parsed = new Date(scanDate);
  if (Number.isNaN(parsed.getTime())) return empty;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function InvoiceLineItemRow({ item }: { item: InvoiceLineItem }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const barcodes = item.barcodes ?? [];
  const hasBarcodes = barcodes.length > 0;
  const showDescription = Boolean(item.description && item.description !== item.itemName);
  const empty = t("common.empty.dash");

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-3 pr-3 align-top">
          <div className="flex items-start gap-2">
            {hasBarcodes ? (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={
                  open
                    ? t("invoices.view.lineItems.hideBarcodes")
                    : t("invoices.view.lineItems.showBarcodes")
                }
                className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="mt-0.5 inline-block size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block">{item.itemName}</span>
              {showDescription ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
              ) : null}
              {hasBarcodes ? (
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className="mt-0.5 text-xs text-primary hover:underline"
                >
                  {open
                    ? t(
                        barcodes.length === 1
                          ? "invoices.view.lineItems.hideBarcodesCount"
                          : "invoices.view.lineItems.hideBarcodesCount_plural",
                        { count: barcodes.length },
                      )
                    : t(
                        barcodes.length === 1
                          ? "invoices.view.lineItems.showBarcodesCount"
                          : "invoices.view.lineItems.showBarcodesCount_plural",
                        { count: barcodes.length },
                      )}
                </button>
              ) : null}
            </span>
          </div>
        </td>
        <td className="py-3 pr-3 align-top">{item.quantity}</td>
        <td className="py-3 pr-3 align-top">{item.labelCount}</td>
        <td className="py-3 pr-3 align-top">{formatInvoiceMoney(item.unitPrice)}</td>
        <td className="py-3 text-right align-top font-medium">{formatInvoiceMoney(item.lineTotal)}</td>
      </tr>
      {hasBarcodes && open ? (
        <tr className="border-b border-border/50 last:border-0">
          <td colSpan={5} className="p-0">
            <div className="overflow-x-auto bg-muted/20">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">
                      {t("invoices.view.barcodeStatus.fields.barcode")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">
                      {t("invoices.view.barcodeStatus.fields.status")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">
                      {t("invoices.view.barcodeStatus.fields.container")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">
                      {t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">
                      {t("invoices.view.fields.scanned")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {barcodes.map((barcode) => (
                    <tr key={barcode.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 align-middle font-mono text-xs" title={barcode.number}>
                        {barcode.number}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {barcode.statusName ? (
                          <TableTagText className={getBarcodeStatusBadgeClass(barcode.statusName)}>
                            {barcode.statusName}
                          </TableTagText>
                        ) : (
                          <span className="text-xs text-muted-foreground">{empty}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {barcode.containerName ?? empty}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {barcode.deliveryName ?? barcode.routeName ?? empty}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {formatBarcodeScanDate(barcode.scanDate, empty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function getPickupAssignmentFieldLabel(
  invoice: Invoice,
  t: (key: string) => string,
): string {
  if (invoice.pickupSource === "warehouse") return t("invoices.form.fields.warehouseEmployee");
  if (invoice.pickupSource === "office") return t("invoices.form.fields.officeEmployee");
  return t("invoices.form.fields.pickupRoute");
}

function formatPickupAssignmentDisplay(
  invoice: Invoice,
  t: (key: string) => string,
): string {
  const empty = t("common.empty.dash");
  const assignment = formatInvoicePickupAssignmentLabel(invoice, t, "");
  if (!assignment) return empty;
  if (
    invoice.pickupSource &&
    isInvoiceEmployeePickupSource(invoice.pickupSource) &&
    invoice.officeBranchName?.trim()
  ) {
    return `${assignment} · ${invoice.officeBranchName.trim()}`;
  }
  return assignment;
}

export function InvoiceViewSheet({
  invoice,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onAddComment,
  onRecordPayment,
}: InvoiceViewSheetProps) {
  const { t } = useTranslation();
  const totals = useMemo(() => {
    if (!invoice) return null;
    const subtotal = getInvoiceSubtotal(invoice);
    const balance = getInvoiceBalance(invoice);
    return { subtotal, balance };
  }, [invoice]);

  if (!invoice || !totals) return null;

  const paidStatus = resolveInvoicePaidStatus(invoice);
  const empty = t("common.empty.dash");
  const pickupSourceKey = invoicePickupSourceLabelKey(invoice.pickupSource);
  const containerLabel = getContainerLabelForInvoice(invoice);
  const pickupReference = invoice.pickupId?.trim()
    ? `#${invoice.pickupId.trim()}`
    : empty;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span>{invoice.invoiceNumber}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatInvoiceDate(invoice.date)}
              </span>
            </span>
          }
          meta={
            <Badge className={getInvoicePaidStatusBadgeClass(paidStatus)}>
              {getInvoicePaidStatusLabel(paidStatus)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          {/* Creation-workflow fields first (aligned with wizard), then view-only sections. */}
          <RecordViewSheetSection title={t("invoices.form.sections.invoiceDetails")}>
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.invoiceNumber")}
              value={invoice.invoiceNumber || empty}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.date")}
              value={formatInvoiceDate(invoice.date) || empty}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.container")}
              value={containerLabel}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.pickupReference")}
              value={pickupReference}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.pickupSource")}
              value={pickupSourceKey ? t(pickupSourceKey) : empty}
            />
            <RecordViewSheetDetailRow
              label={getPickupAssignmentFieldLabel(invoice, t)}
              value={formatPickupAssignmentDisplay(invoice, t)}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.form.fields.paymentLocation")}
              value={getPaymentLocationLabel(invoice.paymentLocation)}
            />
            <RecordViewSheetDetailRow
              label={t("invoices.columns.createdBy")}
              value={invoice.createdBy || empty}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.createdAt")}
              value={formatAuditDateTime(invoice.createdAt) || empty}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedAt")}
              value={formatAuditDateTime(invoice.updatedAt) || empty}
            />
          </RecordViewSheetSection>

          <PartySection title={t("invoices.form.fields.sender")} party={invoice.sender} />
          {invoice.receiver ? (
            <PartySection title={t("invoices.form.fields.receiver")} party={invoice.receiver} />
          ) : (
            <RecordViewSheetSection title={t("invoices.form.fields.receiver")} padding="relaxed">
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noReceiver")}</p>
            </RecordViewSheetSection>
          )}

          <RecordViewSheetSection
            title={t("invoices.wizard.review.lineItems")}
            padding="relaxed"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">
                      {t("invoices.form.lineItems.columns.description")}
                    </th>
                    <th className="pb-3 pr-3 font-medium">
                      {t("invoices.form.lineItems.columns.quantity")}
                    </th>
                    <th className="pb-3 pr-3 font-medium">
                      {t("invoices.form.lineItems.columns.labels")}
                    </th>
                    <th className="pb-3 pr-3 font-medium">
                      {t("invoices.form.lineItems.columns.unitPrice")}
                    </th>
                    <th className="pb-3 font-medium text-right">
                      {t("invoices.form.lineItems.columns.total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-sm text-muted-foreground">
                        {t("invoices.wizard.review.noLineItems")}
                      </td>
                    </tr>
                  ) : (
                    invoice.lineItems.map((item) => (
                      <InvoiceLineItemRow key={item.id} item={item} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-border bg-muted/20 px-1 py-3.5 sm:px-0">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <InvoiceTotalCell
                  label={t("invoices.columns.total")}
                  value={formatInvoiceMoney(totals.subtotal)}
                />
                <InvoiceTotalCell
                  label={t("invoices.columns.discount")}
                  value={formatInvoiceDeduction(invoice.discount)}
                />
                <InvoiceTotalCell
                  label={t("invoices.columns.amountPaid")}
                  value={formatInvoiceDeduction(invoice.amountPaid)}
                  tone={invoice.amountPaid > 0 ? "positive" : "default"}
                />
                <InvoiceTotalCell
                  label={t("invoices.columns.balance")}
                  value={formatInvoiceMoney(totals.balance)}
                  tone="balance"
                />
              </div>
            </div>
          </RecordViewSheetSection>

          <InvoiceCommentsSection
            comments={invoice.comments}
            onAddComment={(description) => onAddComment(invoice.invoiceId, description)}
          />

          <InvoicePaymentsSection
            invoice={invoice}
            onRecordPayment={(input) => onRecordPayment(invoice.invoiceId, input)}
          />

          <InvoiceBarcodeStatusSection invoice={invoice} />

          <InvoicePackageTrackerSection invoice={invoice} />

          <InvoiceActivitySection invoice={invoice} />
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("invoices.workspace.editInvoice")}
          onEdit={() => onEdit(invoice)}
          onDelete={() => onDelete(invoice)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
