"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import {
  Clock3,
  FilePenLine,
  Info,
  Printer,
  Receipt,
  Send,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  TableSelectionActionsMenu,
  TableSelectionActionItem
} from "@/components/app-shell/table-selection-actions-menu";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";

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
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { RecordViewSheetTabs } from "@/components/app-shell/record-view-sheet-tabs";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatOrderDateWithWeekday } from "@/lib/orders/display";
import {
  formatInvoiceMoney,
  formatInvoicePickupAssignmentLabel,
  getContainerLabelForInvoice,
  getInvoiceClearanceBadgeClass,
  getInvoiceClearanceLabel,
  getInvoiceCustomerPaymentBadgeClass,
  getInvoiceCustomerPaymentLabel,
  getInvoicePaidStatusLabel,
  getInvoicePartyCoreAddress,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  invoicePickupSourceLabelKey,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  isInvoiceEmployeePickupSource,
  resolveInvoicePaymentSummary,
  type Invoice,
  type InvoicePaymentSummary,
} from "@/lib/invoices/types";
import type { TranslateFn } from "@/lib/feedback/messages";
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
  /** The invoice has accounting entries, so the API refuses to delete it. */
  deleteBlocked?: boolean;
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
    <RecordViewSheetSection title={title} icon={icon}>
      <RecordViewSheetDetailRow
        label={t("invoices.view.fields.name")}
        value={name || dash}
      />
      {address ? (
        <AddressActionRow label={t("invoices.view.fields.address")} address={address} />
      ) : (
        <RecordViewSheetDetailRow label={t("invoices.view.fields.address")} value={dash} />
      )}
      <RecordViewSheetDetailRow
        label={t("invoices.view.fields.documentId")}
        value={documentId || dash}
      />
      <RecordViewSheetDetailRow
        label={t("invoices.view.fields.email")}
        value={email || dash}
      />
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

/**
 * The totals above are posted figures. Receipts the client already handed over
 * but that have not cleared are totalled here, however many there are, with the
 * balance the invoice settles to once they clear. Renders only when the invoice
 * actually holds an unsettled receipt.
 */
function InvoiceClearanceBreakdown({
  summary,
  t,
}: {
  summary: InvoicePaymentSummary;
  t: TranslateFn;
}) {
  if (summary.pendingClearance <= 0) return null;

  const countKey =
    summary.pendingClearanceCount === 1
      ? "invoices.view.payment.pendingPaymentCount_one"
      : "invoices.view.payment.pendingPaymentCount_other";

  return (
    <div className="mt-2.5 rounded-lg border border-sky-500/40 bg-sky-500/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Clock3 className="size-3.5 shrink-0 text-sky-700 dark:text-sky-300" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
          {t("invoices.view.payment.clearanceBreakdown")}
        </p>
      </div>
      <dl className="mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-muted-foreground">
            {t("invoices.view.payment.pendingClearance")}
            {summary.pendingClearanceCount > 0 ? (
              <>
                {" "}
                <span className="text-muted-foreground/80">
                  · {t(countKey, { count: summary.pendingClearanceCount })}
                </span>
              </>
            ) : null}
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {formatInvoiceMoney(summary.pendingClearance)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-muted-foreground">
            {t("invoices.view.payment.balanceAfterClearance")}
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {formatInvoiceMoney(summary.balanceAfterClearance)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("invoices.view.payment.pendingClearanceHint")}
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
  deleteBlocked = false,
  onManageItems,
  manageItemsDisabled = false,
  onPrint,
  printDisabled = false,
  isPrinting = false,
  onAddComment,
}: InvoiceViewSheetProps) {
  const { t, locale } = useTranslation();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "documents">(
    initialTab ?? "overview",
  );
  const allowRequestChange = hasPermission("canCreateChangeRequest", "change_request");
  const totals = useMemo(() => {
    if (!invoice) return null;
    const subtotal = getInvoiceSubtotal(invoice);
    return { subtotal };
  }, [invoice]);
  const payment = useMemo(
    () => (invoice ? resolveInvoicePaymentSummary(invoice) : null),
    [invoice],
  );

  if (!invoice || !totals || !payment) return null;

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
          icon={Receipt}
          eyebrow={t("invoices.entity")}
          title={invoice.invoiceNumber.trim() || empty}
        />

        <RecordViewSheetTabs
          idPrefix="invoice"
          aria-label={t("invoices.documents.title")}
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { id: "overview" as const, label: t("invoices.documents.overview") },
            { id: "documents" as const, label: t("invoices.documents.title") },
          ]}
        />
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
                label={t("invoices.view.payment.totalPaid")}
                value={formatInvoiceDeduction(payment.totalPaid)}
                tone={payment.totalPaid > 0 ? "positive" : "default"}
              />
              <InvoiceTotalCell
                label={t("invoices.view.payment.outstandingBalance")}
                value={formatInvoiceMoney(payment.outstandingBalance)}
                tone="balance"
              />
            </div>
            <InvoiceClearanceBreakdown summary={payment} t={t} />
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
                label={t("invoices.view.fields.clientPaymentStatus")}
                value={
                  <Badge
                    variant="outline"
                    className={getInvoiceCustomerPaymentBadgeClass(payment.customerStatus)}
                  >
                    {getInvoiceCustomerPaymentLabel(payment.customerStatus, t)}
                  </Badge>
                }
              />
              {payment.clearanceStatus === "NOT_REQUIRED" ? null : (
                <RecordViewSheetDetailRow
                  label={t("invoices.view.fields.clearanceStatus")}
                  value={
                    <Badge
                      variant="outline"
                      className={getInvoiceClearanceBadgeClass(payment.clearanceStatus)}
                    >
                      {getInvoiceClearanceLabel(payment.clearanceStatus, t)}
                    </Badge>
                  }
                />
              )}
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
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPrint(invoice)}
                disabled={isPrinting || printDisabled}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
              >
                <Printer className="size-4" />
                {isPrinting
                  ? t("invoices.wizard.actions.preparing")
                  : t("invoices.wizard.actions.printInvoice")}
              </Button>
              <TableSelectionActionsMenu>
                <TableSelectionActionItem
                  disabled={manageItemsDisabled}
                  onSelect={() => onManageItems(invoice)}
                  className={tableSelectionActionMenuStyles.documents}
                >
                  <Tags className="size-4" />
                  {t("invoices.staging.tableAction")}
                </TableSelectionActionItem>
                {allowRequestChange ? (
                  <TableSelectionActionItem asChild className={tableSelectionActionMenuStyles.request}>
                    <Link href={changeRequestHref("invoice", invoice.invoiceId)}>
                      <FilePenLine className="size-4" />
                      {t("accounting.journalLifecycle.request")}
                    </Link>
                  </TableSelectionActionItem>
                ) : null}
              </TableSelectionActionsMenu>
            </>
          }
          onEdit={canEdit ? () => onEdit(invoice) : undefined}
          onDelete={canDelete ? () => onDelete(invoice) : undefined}
          deleteDisabled={deleteBlocked}
        >
          {canDelete && deleteBlocked ? (
            <p className="text-right text-xs text-muted-foreground">
              {t("invoices.workspace.delete.blockedOne")}
            </p>
          ) : null}
        </RecordViewSheetActions>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
