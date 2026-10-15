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
};

function partyPhoneList(party: Invoice["sender"]): string {
  const formatted = formatPartyPhoneList(party.phones).trim();
  if (!formatted || formatted === "—" || formatted === "-") return "";
  return formatted;
}

function partyAddressLine(party: Invoice["sender"]): string {
  const address = getOrderPartyAddress(party);
  if (!address) return "";
  return formatAddressLine(address).trim();
}

function PartySection({ title, party }: { title: string; party: Invoice["sender"] }) {
  const { t } = useTranslation();
  const name = party.name.trim();
  const documentId = party.documentId?.trim() ?? "";
  const email = party.email?.trim() ?? "";
  const phones = partyPhoneList(party);
  const addressLine = partyAddressLine(party);

  if (!name && !documentId && !email && !phones && !addressLine) return null;

  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      {name ? <p className="text-sm font-medium">{name}</p> : null}
      {documentId ? (
        <p className={cn("text-xs text-muted-foreground", name && "mt-1")}>
          {t("invoices.view.fields.documentId")}: {documentId}
        </p>
      ) : null}
      {email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
      {phones ? (
        <div className={cn(name || documentId || email ? "mt-3" : undefined)}>
          <p className="text-xs font-medium text-primary">{t("invoices.view.fields.phones")}</p>
          <p className="mt-1 text-sm leading-relaxed">{phones}</p>
        </div>
      ) : null}
      {addressLine ? (
        <div className={cn(name || documentId || email || phones ? "mt-4" : undefined)}>
          <p className="text-xs font-medium text-primary">{t("invoices.view.fields.address")}</p>
          <p className="mt-1 text-sm leading-relaxed">{addressLine}</p>
        </div>
      ) : null}
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

function LineItemMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm tabular-nums leading-snug text-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function InvoiceLineItemCard({ item }: { item: InvoiceLineItem }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const barcodes = item.barcodes ?? [];
  const hasBarcodes = barcodes.length > 0;
  const showDescription = Boolean(item.description && item.description !== item.itemName);
  const empty = t("common.empty.dash");
  const panelId = `invoice-line-item-barcodes-${item.id}`;
  const barcodeToggleLabel = open
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
      );

  return (
    <li className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium leading-snug text-foreground">{item.itemName}</p>
        {showDescription ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.description}</p>
        ) : null}
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("invoices.form.lineItems.columns.quantity")}</dt>
            <dd className="tabular-nums text-foreground">{item.quantity}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("invoices.form.lineItems.columns.labels")}</dt>
            <dd className="tabular-nums text-foreground">{item.labelCount}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("invoices.form.lineItems.columns.unitPrice")}</dt>
            <dd className="tabular-nums text-foreground">{formatInvoiceMoney(item.unitPrice)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t("invoices.form.lineItems.columns.total")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatInvoiceMoney(item.lineTotal)}</dd>
          </div>
        </dl>
        {hasBarcodes ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {barcodeToggleLabel}
          </button>
        ) : null}
      </div>
      {hasBarcodes && open ? (
        <ul id={panelId} className="space-y-2 border-t border-border/60 bg-muted/30 px-3 py-2.5">
          {barcodes.map((barcode) => (
            <li key={barcode.id} className="rounded-md border border-border/50 bg-background px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-mono text-xs leading-snug text-foreground [overflow-wrap:anywhere]">
                  {barcode.number}
                </span>
                {barcode.statusName ? (
                  <span className="shrink-0 text-xs">
                    <TableTagText className={getBarcodeStatusBadgeClass(barcode.statusName)}>
                      {barcode.statusName}
                    </TableTagText>
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">{empty}</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <LineItemMetric
                  label={t("invoices.view.barcodeStatus.fields.container")}
                  value={barcode.containerName ?? empty}
                />
                <LineItemMetric
                  label={t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                  value={barcode.deliveryName ?? barcode.routeName ?? empty}
                />
                <LineItemMetric
                  className="col-span-2"
                  label={t("invoices.view.fields.scanned")}
                  value={formatBarcodeScanDate(barcode.scanDate, empty)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
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
          compact
          title={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-lg font-semibold leading-6 tabular-nums tracking-normal">
                {invoice.invoiceNumber}
              </span>
              <span className="text-sm font-normal leading-5 tracking-normal text-muted-foreground">
                {formatInvoiceDate(invoice.date)}
              </span>
              <Badge
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-sm font-medium leading-5 tracking-normal",
                  getInvoicePaidStatusBadgeClass(paidStatus),
                )}
              >
                {getInvoicePaidStatusLabel(paidStatus)}
              </Badge>
            </span>
          }
          meta={
            <dl className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm leading-5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <dt className="font-normal text-muted-foreground">
                  {t("invoices.form.fields.container")}
                </dt>
                <dd className="break-words font-medium text-foreground">
                  {containerLabel}
                </dd>
              </div>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <dt className="font-normal text-muted-foreground">
                  {t("invoices.form.fields.paymentLocation")}
                </dt>
                <dd className="break-words font-medium text-foreground">
                  {getPaymentLocationLabel(invoice.paymentLocation)}
                </dd>
              </div>
            </dl>
          }
        />

        <RecordViewSheetBody>
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
          {pickupReference !== empty || pickupSourceKey || formatPickupAssignmentDisplay(invoice, t) !== empty ? (
            <RecordViewSheetSection title={t("invoices.form.sections.invoiceDetails")}>
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
            </RecordViewSheetSection>
          ) : null}

          <PartySection title={t("invoices.form.fields.sender")} party={invoice.sender} />
          {invoice.receiver ? (
            <PartySection title={t("invoices.form.fields.receiver")} party={invoice.receiver} />
          ) : null}

          <RecordViewSheetSection
            title={t("invoices.wizard.review.lineItems")}
            padding="relaxed"
          >
            {invoice.lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
            ) : (
              <ul className="space-y-2">
                {invoice.lineItems.map((item) => (
                  <InvoiceLineItemCard key={item.id} item={item} />
                ))}
              </ul>
            )}
          </RecordViewSheetSection>

          <InvoiceCommentsSection
            comments={invoice.comments}
            onAddComment={(description) => onAddComment(invoice.invoiceId, description)}
          />

          <InvoicePaymentsSection invoice={invoice} />

          <InvoiceBarcodeStatusSection invoice={invoice} />

          <InvoicePackageTrackerSection invoice={invoice} />

          <InvoiceActivitySection invoice={invoice} />

          <RecordViewSheetSection title={t("invoices.view.system")}>
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
