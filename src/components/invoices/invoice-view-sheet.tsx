"use client";

import { RequestChangeButton } from "@/components/change-requests/request-change-button";

import { useMemo, useState } from "react";
import {
  Info,
  MapPin,
  Phone as PhoneIcon,
  Printer,
  Receipt,
  Send,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { InvoiceLineItemsSection } from "@/components/invoices/invoice-line-items-section";
import { InvoiceDocumentsSection } from "@/components/invoices/invoice-documents-section";
import { InvoiceActivitySection } from "@/components/invoices/invoice-activity-section";
import { InvoiceBarcodeStatusSection } from "@/components/invoices/invoice-barcode-status-section";
import { InvoiceCommentsSection } from "@/components/invoices/invoice-comments-section";
import { InvoicePackageTrackerSection } from "@/components/invoices/invoice-package-tracker-section";
import { InvoicePaymentsSection } from "@/components/invoices/invoice-payments-section";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
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
import { formatOrderDateWithWeekday } from "@/lib/orders/display";
import {
  formatInvoiceMoney,
  formatInvoicePickupAssignmentLabel,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoicePaidStatusLabel,
  getInvoicePartyCoreAddress,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  invoicePickupSourceLabelKey,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  isInvoiceEmployeePickupSource,
  type Invoice,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceViewSheetProps = {
  invoice: Invoice | null;
  initialTab?: "overview" | "documents";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onManageItems: (invoice: Invoice) => void;
  manageItemsDisabled?: boolean;
  onPrint: (invoice: Invoice) => void;
  printDisabled?: boolean;
  isPrinting?: boolean;
  onAddComment: (invoiceId: string, description: string) => void;
};

function getOrderedPartyPhones(phones: Invoice["sender"]["phones"]) {
  const withNumbers = phones.filter((phone) => phone.number.trim());
  return [
    ...withNumbers.filter((phone) => phone.isPrimary),
    ...withNumbers.filter((phone) => !phone.isPrimary),
  ];
}

function PartySection({
  title,
  party,
  icon,
}: {
  title: string;
  party: Invoice["sender"];
  icon: LucideIcon;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const name = party.name.trim();
  const documentId = party.documentId?.trim() ?? "";
  const email = party.email?.trim() ?? "";
  const phones = getOrderedPartyPhones(party.phones);
  const address = getInvoicePartyCoreAddress(party);

  if (!name && !documentId && !email && phones.length === 0 && !address) return null;

  return (
    <>
      <RecordViewSheetSection title={title} icon={icon}>
        <RecordViewSheetDetailRow
          label={t("invoices.view.fields.name")}
          value={name || dash}
        />
        <RecordViewSheetDetailRow
          label={t("invoices.view.fields.documentId")}
          value={documentId || dash}
        />
        <RecordViewSheetDetailRow
          label={t("invoices.view.fields.email")}
          value={email || dash}
        />
      </RecordViewSheetSection>

      <RecordViewSheetSection title={t("invoices.view.fields.phones")} icon={PhoneIcon}>
        {phones.length === 0 ? (
          <RecordViewSheetDetailRow label={t("invoices.view.fields.phones")} value={dash} />
        ) : (
          phones.map((phone, index) => (
            <PhoneActionRow
              key={`${title}-phone-${index}`}
              label={phone.label?.trim() || t("phones.types.other")}
              number={phone.number}
              displayNumber={phone.displayNumber}
              isPrimary={Boolean(phone.isPrimary)}
            />
          ))
        )}
      </RecordViewSheetSection>

      <RecordViewSheetSection title={t("invoices.view.fields.address")} icon={MapPin}>
        {address ? (
          <AddressActionRow label="" address={address} isPrimary={address.isPrimary} />
        ) : (
          <RecordViewSheetDetailRow label={t("invoices.view.fields.address")} value={dash} />
        )}
      </RecordViewSheetSection>
    </>
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
        isBalance
          ? "border-primary/40 bg-primary/10"
          : "border-border/60 bg-background",
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
          tone === "positive" &&
            "font-semibold text-emerald-600 dark:text-emerald-400",
          tone === "default" && "font-semibold text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function getPickupAssignmentFieldLabel(
  invoice: Invoice,
  t: (key: string) => string,
): string {
  if (invoice.pickupSource === "warehouse")
    return t("invoices.form.fields.warehouseEmployee");
  if (invoice.pickupSource === "office")
    return t("invoices.form.fields.officeEmployee");
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
  initialTab = "overview",
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  onManageItems,
  manageItemsDisabled = false,
  onPrint,
  printDisabled = false,
  isPrinting = false,
  onAddComment,
}: InvoiceViewSheetProps) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
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
      <RecordViewSheetContent
        className={activeTab === "documents" ? "sm:max-w-6xl" : undefined}
      >
        <RecordViewSheetHeader
          title={invoice.invoiceNumber.trim() || empty}
          actions={
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => onManageItems(invoice)}
                disabled={manageItemsDisabled}
              >
                <Tags className="h-4 w-4" />
                {t("invoices.staging.tableAction")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPrint(invoice)}
                disabled={isPrinting || printDisabled}
                className={cn(
                  "whitespace-nowrap",
                  tableSelectionActionStyles.print,
                )}
              >
                <Printer className="h-4 w-4" />
                {isPrinting
                  ? t("invoices.wizard.actions.preparing")
                  : t("invoices.wizard.actions.printInvoice")}
              </Button>
            </>
          }
        />

        <div
          role="tablist"
          aria-label={t("invoices.documents.title")}
          className="flex gap-6 border-b px-6"
        >
          {["overview", "documents"].map((tab) => (
            <button
              key={tab}
              id={`invoice-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onKeyDown={(event) => {
                let next: string | undefined;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight")
                  next = tab === "overview" ? "documents" : "overview";
                if (event.key === "Home") next = "overview";
                if (event.key === "End") next = "documents";
                if (next) {
                  event.preventDefault();
                  setActiveTab(next);
                  document.getElementById(`invoice-tab-${next}`)?.focus();
                }
              }}
              aria-controls={`invoice-panel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 px-1 py-3 text-sm font-medium",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {t(
                `invoices.documents.${tab === "overview" ? "overview" : "title"}`,
              )}
            </button>
          ))}
        </div>
        {activeTab === "documents" ? (
          <RecordViewSheetBody>
            <div
              role="tabpanel"
              id="invoice-panel-documents"
              aria-labelledby="invoice-tab-documents"
            >
              <InvoiceDocumentsSection
                key={invoice.invoiceId}
                invoice={invoice}
              />
            </div>
          </RecordViewSheetBody>
        ) : (
          <RecordViewSheetBody
            role="tabpanel"
            id="invoice-panel-overview"
            aria-labelledby="invoice-tab-overview"
          >
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
            <RecordViewSheetSection
              title={t("invoices.form.sections.invoiceDetails")}
              icon={Receipt}
            >
              <RecordViewSheetDetailRow
                label={t("invoices.form.fields.date")}
                value={formatOrderDateWithWeekday(invoice.date, locale)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.form.fields.container")}
                value={containerLabel}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.fields.paymentStatus")}
                value={
                  <Badge
                    variant="outline"
                    className={
                      paidStatus === "closed"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }
                  >
                    {getInvoicePaidStatusLabel(paidStatus, t)}
                  </Badge>
                }
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.fields.paymentLocation")}
                value={getPaymentLocationLabel(invoice.paymentLocation)}
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
            </RecordViewSheetSection>

            <PartySection
              title={t("invoices.form.fields.sender")}
              party={invoice.sender}
              icon={Send}
            />
            {invoice.receiver ? (
              <PartySection
                title={t("invoices.form.fields.receiver")}
                party={invoice.receiver}
                icon={UserRound}
              />
            ) : null}

            <InvoiceLineItemsSection lineItems={invoice.lineItems} />

            <InvoiceCommentsSection
              comments={invoice.comments}
              onAddComment={(description) =>
                onAddComment(invoice.invoiceId, description)
              }
            />

            <InvoicePaymentsSection invoice={invoice} />

            <InvoiceBarcodeStatusSection invoice={invoice} />

            <InvoicePackageTrackerSection invoice={invoice} />

            <InvoiceActivitySection invoice={invoice} />

            <RecordViewSheetSection title={t("invoices.view.system")} icon={Info}>
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
        )}

        <RecordViewSheetActions
          leading={
            <RequestChangeButton
              resourceType="invoice"
              resourceId={invoice.invoiceId}
            />
          }
          onEdit={canEdit ? () => onEdit(invoice) : undefined}
          onDelete={canDelete ? () => onDelete(invoice) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
