"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import {
  FilePenLine,
  FileText,
  Info,
  Printer,
  Receipt,
  Send,
  Tags,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  TableSelectionActionsMenu,
  TableSelectionActionItem,
  TableSelectionActionSeparator,
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
  getContainerLabelForInvoice,
  getInvoicePaidStatusLabel,
  getInvoicePartyCoreAddress,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  resolveInvoicePaymentSummary,
  type Invoice,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { RECORD_PHONE_TYPE_OPTIONS, type RecordPhoneType } from "@/lib/phones/types";
import { cn } from "@/lib/utils";

type InvoiceViewTab = "overview" | "documents" | "tracking";

type InvoiceViewEditOptions = {
  /** Land on this invoice wizard step (1 = details, 2 = parties, 3 = line items / totals). */
  initialWizardStep?: number;
};

type InvoiceViewSheetProps = {
  invoice: Invoice | null;
  initialTab?: InvoiceViewTab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: Invoice, options?: InvoiceViewEditOptions) => void;
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

const PHONE_TYPE_VALUES = new Set<string>(
  RECORD_PHONE_TYPE_OPTIONS.map((option) => option.value),
);

function resolveInvoicePartyPhoneTypeLabel(
  label: string | undefined,
  t: (key: string) => string,
): string {
  const normalized = label?.trim().toLowerCase() ?? "";
  if (PHONE_TYPE_VALUES.has(normalized)) {
    return t(`phones.types.${normalized as RecordPhoneType}`);
  }
  return label?.trim() || t("phones.types.other");
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
        layout="stacked"
      />
      {address ? (
        <AddressActionRow label={t("invoices.view.fields.address")} address={address} />
      ) : (
        <RecordViewSheetDetailRow
          label={t("invoices.view.fields.address")}
          value={dash}
          layout="stacked"
        />
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
            label={resolveInvoicePartyPhoneTypeLabel(phone.label, t)}
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
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base tabular-nums",
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
  const [activeTab, setActiveTab] = useState<InvoiceViewTab>(
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
  const openTone = paidStatus === "open" ? "text-red-700 dark:text-red-300" : undefined;
  const empty = t("common.empty.dash");
  const containerLabel = getContainerLabelForInvoice(invoice);
  const pickupReference = invoice.pickupId?.trim()
    ? `#${invoice.pickupId.trim()}`
    : empty;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent
        className={
          activeTab === "documents" || activeTab === "tracking"
            ? "sm:max-w-6xl"
            : undefined
        }
      >
        <RecordViewSheetHeader
          icon={Receipt}
          eyebrow={t("invoices.entity")}
          title={invoice.invoiceNumber.trim() || empty}
        />

        <RecordViewSheetTabs
          idPrefix="invoice"
          aria-label={t("invoices.view.tabs")}
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { id: "overview" as const, label: t("invoices.documents.overview") },
            { id: "documents" as const, label: t("invoices.documents.title") },
            { id: "tracking" as const, label: t("invoices.view.tracking") },
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
        ) : activeTab === "tracking" ? (
          <RecordViewSheetBody
            role="tabpanel"
            id="invoice-panel-tracking"
            aria-labelledby="invoice-tab-tracking"
          >
            <InvoiceBarcodeStatusSection invoice={invoice} />
            <InvoicePackageTrackerSection invoice={invoice} />
            <InvoiceActivitySection invoice={invoice} />
          </RecordViewSheetBody>
        ) : (
          <RecordViewSheetBody
            role="tabpanel"
            id="invoice-panel-overview"
            aria-labelledby="invoice-tab-overview"
          >
            <RecordViewSheetSection
              title={t("invoices.view.totals")}
              icon={Wallet}
            >
              <div className="grid grid-cols-3 gap-2.5 p-4">
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
              </div>
            </RecordViewSheetSection>
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
                labelClassName={openTone}
                value={
                  <Badge
                    variant="outline"
                    className={
                      paidStatus === "closed"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                    }
                  >
                    {getInvoicePaidStatusLabel(paidStatus, t)}
                  </Badge>
                }
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.payment.outstandingBalance")}
                labelClassName={openTone}
                value={<span className={cn("font-semibold", openTone)}>{formatInvoiceMoney(payment.outstandingBalance)}</span>}
              />
              {payment.pendingClearance > 0 && (
                <RecordViewSheetDetailRow
                  label={t("invoices.view.payment.balanceToClear")}
                  labelClassName="text-yellow-800 dark:text-yellow-300"
                  value={<span className="font-semibold text-yellow-800 dark:text-yellow-300">{formatInvoiceMoney(payment.pendingClearance)}</span>}
                />
              )}
              <RecordViewSheetDetailRow
                label={t("invoices.view.fields.paymentLocation")}
                value={invoice.paymentBranchName || getPaymentLocationLabel(invoice.paymentLocation)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.form.fields.pickupReference")}
                value={pickupReference}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.form.fields.pickupRoute")}
                value={invoice.dailyRouteName || (invoice.pickupSource === "route" && invoice.routeName) || empty}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.form.fields.supervisorEmployee")}
                value={invoice.supervisor?.name || invoice.pickupEmployeeName || empty}
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
                  : t("invoices.wizard.actions.print")}
              </Button>
              <TableSelectionActionsMenu>
                {canEdit ? (
                  <>
                    <TableSelectionActionItem
                      onSelect={() => onEdit(invoice, { initialWizardStep: 3 })}
                      className={tableSelectionActionMenuStyles.edit}
                    >
                      <Wallet className="size-4" />
                      {t("invoices.view.actions.editTotals")}
                    </TableSelectionActionItem>
                    <TableSelectionActionItem
                      onSelect={() => onEdit(invoice, { initialWizardStep: 1 })}
                      className={tableSelectionActionMenuStyles.edit}
                    >
                      <Receipt className="size-4" />
                      {t("invoices.view.actions.editInvoiceDetails")}
                    </TableSelectionActionItem>
                    <TableSelectionActionItem
                      onSelect={() => onEdit(invoice, { initialWizardStep: 2 })}
                      className={tableSelectionActionMenuStyles.edit}
                    >
                      <Send className="size-4" />
                      {t("invoices.form.partyActions.editSender")}
                    </TableSelectionActionItem>
                    {invoice.receiver ? (
                      <TableSelectionActionItem
                        onSelect={() => onEdit(invoice, { initialWizardStep: 2 })}
                        className={tableSelectionActionMenuStyles.edit}
                      >
                        <UserRound className="size-4" />
                        {t("invoices.form.partyActions.editReceiver")}
                      </TableSelectionActionItem>
                    ) : null}
                    <TableSelectionActionSeparator />
                  </>
                ) : null}
                <TableSelectionActionItem
                  onSelect={() => setActiveTab("documents")}
                  className={tableSelectionActionMenuStyles.documents}
                >
                  <FileText className="size-4" />
                  {t("invoices.view.actions.manageDocuments")}
                </TableSelectionActionItem>
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
