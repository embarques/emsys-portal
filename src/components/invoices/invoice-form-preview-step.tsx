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
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";

export type InvoicePreviewPaymentSummary = {
  registration: DailyIncomeJournal | null;
  incomeStatementId: number | null;
  paymentSkipped: boolean;
};

type Props = {
  values: InvoiceFormValues;
  appearance?: "default" | "wizard" | "phoneWizard";
  onEditStep?: (step: InvoiceWizardFormStep) => void;
  showPaymentSection?: boolean;
  paymentSummary?: InvoicePreviewPaymentSummary;
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
  isPhoneWizard = false,
  onEditStep,
  showPaymentSection,
  paymentSummary,
  onEditPayment,
  errorMessage,
}: Required<Pick<Props, "values">> &
  Pick<
    Props,
    "onEditStep" | "showPaymentSection" | "paymentSummary" | "onEditPayment" | "errorMessage"
  > & { isPhoneWizard?: boolean }) {
  const { t } = useTranslation();
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
    <div
      id="invoice-wizard-print-area"
      className={isPhoneWizard ? "space-y-4" : "divide-y divide-border px-5 py-2 sm:px-8"}
    >
      {errorMessage ? (
        <div className="py-3 print:hidden">
          <InvoiceWizardNotice tone="error" message={errorMessage} className="rounded-lg border" />
        </div>
      ) : null}
      <InvoiceWizardReviewSection
        number={1}
        title={t("invoices.wizard.review.invoiceDetails")}
        onEdit={onEditStep ? () => onEditStep(1) : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InvoiceWizardReviewTextBlock
            label={t("invoices.wizard.review.invoice")}
            value={
              <>
                <p>{values.invoiceNumber || t("common.empty.dash")}</p>
                <p>{formatInvoiceDate(values.date) || values.date || t("common.empty.dash")}</p>
              </>
            }
          />
          <InvoiceWizardReviewTextBlock
            label={t("invoices.wizard.review.shipment")}
            value={
              <>
                <p>
                  {t("invoices.wizard.review.container")}: {containerLabel}
                </p>
                <p>
                  {pickupFieldLabel}: {pickupLabel}
                </p>
                <p>
                  {pickupAssignmentFieldLabel}: {pickupAssignmentLabel}
                </p>
                <p>
                  {t("invoices.wizard.review.pending")}: {getPaymentLocationLabel(values.paymentLocation)}
                </p>
              </>
            }
          />
        </div>
      </InvoiceWizardReviewSection>

      <InvoiceWizardReviewSection
        number={2}
        title={t("invoices.wizard.review.senderReceiver")}
        onEdit={onEditStep ? () => onEditStep(2) : undefined}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("invoices.wizard.review.sender")}</p>
            {values.sender ? (
              <CustomerContactSummary customer={values.sender} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.notSelected")}</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("invoices.wizard.review.receiver")}</p>
            {values.receiver ? (
              <CustomerContactSummary customer={values.receiver} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noReceiver")}</p>
            )}
          </div>
        </div>
      </InvoiceWizardReviewSection>

      <InvoiceWizardReviewSection
        number={3}
        title={t("invoices.wizard.review.lineItems")}
        onEdit={onEditStep ? () => onEditStep(3) : undefined}
      >
        {lineItemRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {t(lineItemRows.length === 1 ? "invoices.wizard.review.itemsSummary" : "invoices.wizard.review.itemsSummary_plural", {
                count: lineItemRows.length,
                subtotal: formatInvoiceMoney(subtotal),
              })}
              {discount > 0
                ? t("invoices.wizard.review.discountSuffix", { discount: formatInvoiceMoney(discount) })
                : ""}
            </p>
            <ul className="list-inside list-disc space-y-1">
              {lineItemRows.map((item) => {
                const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                const label = item.itemName.trim() || catalogItem?.description || t("invoices.wizard.summary.lineItem");
                return (
                  <li key={item.id}>
                    {label} · {t("invoices.wizard.review.qty")} {item.quantity || "1"} ·{" "}
                    {formatInvoiceMoney(resolveLineTotal(item))}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </InvoiceWizardReviewSection>

      {showPaymentSection ? (
        <InvoiceWizardReviewSection
          number={4}
          title={t("invoices.wizard.review.dailyIncomePayment")}
          onEdit={onEditPayment}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              {paymentSummary?.registration ? (
                <>
                  <p className="font-medium text-foreground">
                    {paymentSummary.paymentSkipped && paymentSummary.registration.amount === 0
                      ? t("invoices.wizard.review.zeroPaymentRegistered")
                      : t("invoices.wizard.review.registrationConfirmed")}
                  </p>
                  <p className="text-muted-foreground">
                    {paymentSummary.paymentSkipped && paymentSummary.registration.amount === 0
                      ? t("invoices.wizard.review.zeroPaymentRegisteredHint")
                      : t("invoices.wizard.review.initialPayment", {
                          amount: formatInvoiceMoney(paymentSummary.registration.amount),
                        })}
                  </p>
                </>
              ) : paymentSummary?.incomeStatementId ? (
                <>
                  <p className="font-medium text-foreground">
                    {t("invoices.wizard.review.cuadreLinked")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("invoices.wizard.review.cuadreLinkedHint", {
                      id: paymentSummary.incomeStatementId,
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    {t("invoices.wizard.review.paymentSkipped")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("invoices.wizard.review.paymentSkippedHint")}
                  </p>
                </>
              )}
            </div>
          </div>
        </InvoiceWizardReviewSection>
      ) : null}

      <InvoiceWizardReviewSection
        number={showPaymentSection ? 5 : 4}
        title={t("invoices.wizard.stepTitles.reviewAndSave")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.reviewIntro")}</p>

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">
              {t("invoices.wizard.review.yourItems")}
            </h4>
            {lineItemRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
            ) : (
              isPhoneWizard ? (
                <div className="space-y-3">
                  {lineItemRows.map((item) => {
                    const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                    const label =
                      item.itemName.trim() ||
                      catalogItem?.description ||
                      t("invoices.wizard.summary.lineItem");
                    const labelCount = Number(item.labelCount) || 0;

                    return (
                      <article key={item.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold text-foreground">{label}</p>
                            {item.labelCount ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t(
                                  labelCount === 1
                                    ? "invoices.wizard.review.labels"
                                    : "invoices.wizard.review.labels_plural",
                                  { count: labelCount },
                                )}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-sm font-semibold">
                            {formatInvoiceMoney(resolveLineTotal(item))}
                          </p>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <dt>{t("invoices.wizard.review.table.qty")}</dt>
                            <dd className="mt-1 font-semibold text-foreground">
                              {item.quantity || t("common.empty.dash")}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <dt>{t("invoices.wizard.review.table.unitPrice")}</dt>
                            <dd className="mt-1 font-semibold text-foreground">
                              {formatInvoiceMoney(Number(item.unitPrice) || 0)}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t("invoices.wizard.review.table.item")}</th>
                        <th className="px-4 py-3 font-medium">{t("invoices.wizard.review.table.qty")}</th>
                        <th className="px-4 py-3 font-medium">{t("invoices.wizard.review.table.unitPrice")}</th>
                        <th className="px-4 py-3 font-medium text-right">
                          {t("invoices.wizard.review.table.subtotal")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItemRows.map((item) => {
                        const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                        const label =
                          item.itemName.trim() ||
                          catalogItem?.description ||
                          t("invoices.wizard.summary.lineItem");
                        const labelCount = Number(item.labelCount) || 0;
                        return (
                          <tr key={item.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{label}</p>
                              {item.labelCount ? (
                                <p className="text-xs text-muted-foreground">
                                  {t(
                                    labelCount === 1
                                      ? "invoices.wizard.review.labels"
                                      : "invoices.wizard.review.labels_plural",
                                    { count: labelCount },
                                  )}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.quantity || t("common.empty.dash")}
                            </td>
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
              )
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
  paymentSummary,
  onEditPayment,
  errorMessage = null,
}: Props) {
  const isPhoneWizard = appearance === "phoneWizard";
  const isWizard = appearance === "wizard" || isPhoneWizard;
  const { subtotal, discount, amountPaid, balance, lineItemRows, catalogItems, containerLabel, pickupLabel, pickupFieldLabel, pickupAssignmentLabel, pickupAssignmentFieldLabel } =
    usePreviewLabels(values);

  if (isWizard) {
    return (
      <InvoiceWizardCheckoutReview
        values={values}
        isPhoneWizard={isPhoneWizard}
        onEditStep={onEditStep}
        showPaymentSection={showPaymentSection}
        paymentSummary={paymentSummary}
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
