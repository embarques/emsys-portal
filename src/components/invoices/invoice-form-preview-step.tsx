"use client";

import { useMemo } from "react";

import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import {
  InvoiceWizardReviewSection,
  InvoiceWizardReviewTextBlock,
} from "@/components/invoices/invoice-wizard-review-section";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { formatInvoiceDate, formatInvoiceMoney, getPaymentLocationLabel } from "@/lib/invoices/display";
import {
  computeInvoiceBalance,
  isInvoiceEmployeePickupSource,
  resolveLineTotal,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useItemPicker } from "@/lib/items/hooks/use-items";
import { formatActiveRouteAssignmentLabel } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { DEFAULT_ORDER_LIST_PARAMS } from "@/lib/orders/types";
import { useOrder, useOrders } from "@/lib/orders/hooks/use-orders";
import { ClipboardList, Eye, Receipt, Users, Wallet } from "lucide-react";
import type { InvoiceWizardFormStep } from "@/components/invoices/invoice-wizard-stepper";

type Props = {
  values: InvoiceFormValues;
  appearance?: "default" | "wizard";
  onEditStep?: (step: InvoiceWizardFormStep) => void;
  showPaymentSection?: boolean;
  onEditPayment?: () => void;
  errorMessage?: string | null;
};

function usePreviewLabels(values: InvoiceFormValues) {
  const { t } = useTranslation();
  const { data: containersData } = useContainerPicker();
  const ordersQuery = useOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 200 });
  const selectedPickupQuery = useOrder(values.pickupId || null, Boolean(values.pickupId));
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200);
  const { data: itemsData } = useItemPicker();

  const containers = containersData?.items ?? [];
  const orders = ordersQuery.data?.items ?? [];
  const pickupRoutes = pickupRoutesQuery.data?.items ?? [];
  const catalogItems = itemsData?.items ?? [];

  const containerLabel = useMemo(() => {
    const container = containers.find((entry) => String(entry.id) === values.containerId);
    return container ? formatContainerLabel(container) : values.containerId || "—";
  }, [containers, values.containerId]);

  const pickupLabel = useMemo(() => {
    if (!values.pickupId) return t("invoices.form.placeholders.noPickupReference");
    const order =
      orders.find((entry) => String(entry.id) === values.pickupId) ??
      (selectedPickupQuery.data && String(selectedPickupQuery.data.id) === values.pickupId
        ? selectedPickupQuery.data
        : null);
    return order ? `#${order.id}${order.sender?.name ? ` · ${order.sender.name}` : ""}` : values.pickupId;
  }, [orders, selectedPickupQuery.data, t, values.pickupId]);

  const pickupFieldLabel = t("invoices.form.fields.pickupReference");

  const pickupAssignmentLabel = useMemo(() => {
    if (isInvoiceEmployeePickupSource(values.pickupSource)) {
      const employee = values.pickupEmployeeName.trim() || values.pickupEmployeeId;
      if (!employee) return t("invoices.form.preview.noEmployeeAssignment");
      const branch = values.officeBranchName.trim();
      return branch ? `${employee} · ${branch}` : employee;
    }

    if (!values.routeId) return t("invoices.form.placeholders.noPickupRoute");
    const route = pickupRoutes.find((entry) => entry.id === values.routeId);
    return route ? formatActiveRouteAssignmentLabel(route, t) : values.routeId;
  }, [
    pickupRoutes,
    t,
    values.officeBranchName,
    values.pickupEmployeeId,
    values.pickupEmployeeName,
    values.pickupSource,
    values.routeId,
  ]);

  const pickupAssignmentFieldLabel = useMemo(() => {
    if (values.pickupSource === "warehouse") return t("invoices.form.fields.warehouseEmployee");
    if (values.pickupSource === "office") return t("invoices.form.fields.officeEmployee");
    return t("invoices.form.fields.pickupRoute");
  }, [t, values.pickupSource]);

  const subtotal = useMemo(
    () => values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [values.lineItems],
  );
  const discount = Number(values.discount) || 0;
  const amountPaid = Number(values.amountPaid) || 0;
  const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

  const lineItemRows = values.lineItems.filter(
    (item) => item.itemName.trim() || item.itemId || resolveLineTotal(item) > 0,
  );

  return {
    catalogItems,
    containerLabel,
    pickupLabel,
    pickupFieldLabel,
    pickupAssignmentLabel,
    pickupAssignmentFieldLabel,
    subtotal,
    discount,
    amountPaid,
    balance,
    lineItemRows,
  };
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function InvoiceWizardCheckoutReview({
  values,
  onEditStep,
  showPaymentSection,
  onEditPayment,
  errorMessage,
}: Required<Pick<Props, "values">> &
  Pick<Props, "onEditStep" | "showPaymentSection" | "onEditPayment" | "errorMessage">) {
  const {
    catalogItems,
    containerLabel,
    pickupLabel,
    pickupFieldLabel,
    pickupAssignmentLabel,
    pickupAssignmentFieldLabel,
    subtotal,
    discount,
    lineItemRows,
  } = usePreviewLabels(values);

  return (
    <div id="invoice-wizard-print-area" className="divide-y divide-border px-5 py-2 sm:px-8">
      {errorMessage ? (
        <div className="py-3 print:hidden">
          <InvoiceWizardNotice tone="error" message={errorMessage} className="rounded-lg border" />
        </div>
      ) : null}
      <InvoiceWizardReviewSection
        number={1}
        title="Invoice details"
        onEdit={onEditStep ? () => onEditStep(1) : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InvoiceWizardReviewTextBlock
            label="Invoice"
            value={
              <>
                <p>{values.invoiceNumber || "—"}</p>
                <p>{formatInvoiceDate(values.date) || values.date || "—"}</p>
              </>
            }
          />
          <InvoiceWizardReviewTextBlock
            label="Shipment"
            value={
              <>
                <p>Container: {containerLabel}</p>
                <p>{pickupFieldLabel}: {pickupLabel}</p>
                <p>{pickupAssignmentFieldLabel}: {pickupAssignmentLabel}</p>
                <p>Pending: {getPaymentLocationLabel(values.paymentLocation)}</p>
              </>
            }
          />
        </div>
      </InvoiceWizardReviewSection>

      <InvoiceWizardReviewSection
        number={2}
        title="Sender & receiver"
        onEdit={onEditStep ? () => onEditStep(2) : undefined}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Sender</p>
            {values.sender ? (
              <CustomerContactSummary customer={values.sender} />
            ) : (
              <p className="text-sm text-muted-foreground">Not selected</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Receiver</p>
            {values.receiver ? (
              <CustomerContactSummary customer={values.receiver} />
            ) : (
              <p className="text-sm text-muted-foreground">No receiver</p>
            )}
          </div>
        </div>
      </InvoiceWizardReviewSection>

      <InvoiceWizardReviewSection
        number={3}
        title="Line items"
        onEdit={onEditStep ? () => onEditStep(3) : undefined}
      >
        {lineItemRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items</p>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {lineItemRows.length} item{lineItemRows.length === 1 ? "" : "s"} · Subtotal{" "}
              {formatInvoiceMoney(subtotal)}
              {discount > 0 ? ` · Discount ${formatInvoiceMoney(discount)}` : ""}
            </p>
            <ul className="list-inside list-disc space-y-1">
              {lineItemRows.map((item) => {
                const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                const label = item.itemName.trim() || catalogItem?.description || "Line item";
                return (
                  <li key={item.id}>
                    {label} · Qty {item.quantity || "1"} · {formatInvoiceMoney(resolveLineTotal(item))}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </InvoiceWizardReviewSection>

      {showPaymentSection ? (
        <InvoiceWizardReviewSection number={4} title="Daily Income payment" onEdit={onEditPayment}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Registration confirmed</p>
              <p className="text-muted-foreground">
                Initial payment: {formatInvoiceMoney(Number(values.amountPaid) || 0)}
              </p>
            </div>
          </div>
        </InvoiceWizardReviewSection>
      ) : null}

      <InvoiceWizardReviewSection number={showPaymentSection ? 5 : 4} title="Review & save invoice">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Review your items below. When you are ready, save the invoice from the action bar.
          </p>

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">
              Your items
            </h4>
            {lineItemRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Unit price</th>
                      <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItemRows.map((item) => {
                      const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                      const label = item.itemName.trim() || catalogItem?.description || "Line item";
                      return (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{label}</p>
                            {item.labelCount ? (
                              <p className="text-xs text-muted-foreground">
                                {item.labelCount} label{item.labelCount === "1" ? "" : "s"}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.quantity || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatInvoiceMoney(Number(item.unitPrice) || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatInvoiceMoney(resolveLineTotal(item))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </InvoiceWizardReviewSection>
    </div>
  );
}

export function InvoiceFormPreviewStep({
  values,
  appearance = "default",
  onEditStep,
  showPaymentSection = false,
  onEditPayment,
  errorMessage = null,
}: Props) {
  const isWizard = appearance === "wizard";
  const { subtotal, discount, amountPaid, balance, lineItemRows, catalogItems, containerLabel, pickupLabel, pickupFieldLabel, pickupAssignmentLabel, pickupAssignmentFieldLabel } =
    usePreviewLabels(values);

  if (isWizard) {
    return (
      <InvoiceWizardCheckoutReview
        values={values}
        onEditStep={onEditStep}
        showPaymentSection={showPaymentSection}
        onEditPayment={onEditPayment}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <FormBody>
      {errorMessage ? (
        <InvoiceWizardNotice tone="error" message={errorMessage} className="rounded-lg border" />
      ) : null}
      <FormSection icon={Eye} title="Review before saving">
        <p className="text-sm text-muted-foreground">
          Confirm the invoice details below. Use Back to make changes.
        </p>
      </FormSection>

      <FormSection icon={Receipt} title="Invoice details">
        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewField label="Date" value={values.date} />
          <PreviewField label="Invoice number" value={values.invoiceNumber} />
          <PreviewField label={pickupFieldLabel} value={pickupLabel} />
          <PreviewField label="Container" value={containerLabel} />
          <PreviewField label="Pending" value={getPaymentLocationLabel(values.paymentLocation)} />
          <PreviewField label={pickupAssignmentFieldLabel} value={pickupAssignmentLabel} />
        </div>
      </FormSection>

      <FormSection icon={Users} title="Sender & receiver">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sender</p>
            {values.sender ? (
              <CustomerContactSummary customer={values.sender} />
            ) : (
              <p className="text-sm text-muted-foreground">Not selected</p>
            )}
          </div>
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receiver</p>
            {values.receiver ? (
              <CustomerContactSummary customer={values.receiver} />
            ) : (
              <p className="text-sm text-muted-foreground">No receiver</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection icon={ClipboardList} title="Description">
        {lineItemRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItemRows.map((item) => {
                  const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                  const label = item.itemName.trim() || catalogItem?.description || "Line item";
                  return (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">{item.quantity || "—"}</td>
                      <td className="px-3 py-2">{formatInvoiceMoney(Number(item.unitPrice) || 0)}</td>
                      <td className="px-3 py-2 font-medium">{formatInvoiceMoney(resolveLineTotal(item))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection icon={Wallet} title="Totals">
        <div className="space-y-2 rounded-lg border bg-background p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatInvoiceMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium">−{formatInvoiceMoney(discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-medium">−{formatInvoiceMoney(amountPaid)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Balance</span>
            <span>{formatInvoiceMoney(balance)}</span>
          </div>
        </div>
      </FormSection>
    </FormBody>
  );
}
