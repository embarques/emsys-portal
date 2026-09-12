"use client";

import { useMemo } from "react";

import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import {
  InvoiceWizardReviewOptionalMissing,
  InvoiceWizardReviewSection,
  InvoiceWizardReviewTextBlock,
} from "@/components/invoices/invoice-wizard-review-section";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { formatInvoiceDate, formatInvoiceMoney, getPaymentLocationLabel } from "@/lib/invoices/display";
import {
  computeInvoiceBalance,
  INVOICE_PICKUP_SOURCES,
  isInvoiceEmployeePickupSource,
  resolveLineLabelCount,
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

  const pickupSourceLabel = useMemo(() => {
    const option = INVOICE_PICKUP_SOURCES.find((entry) => entry.value === values.pickupSource);
    return option ? t(option.labelKey) : t("invoices.form.fields.pickupSource");
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
    pickupSourceLabel,
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

function ReviewLineItemLabels({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count > 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(count === 1 ? "invoices.wizard.review.labels" : "invoices.wizard.review.labels_plural", {
          count,
        })}
      </p>
    );
  }

  return (
    <p className="text-xs">
      <InvoiceWizardReviewOptionalMissing>{t("invoices.wizard.review.noLabels")}</InvoiceWizardReviewOptionalMissing>
    </p>
  );
}

function ReviewWarningMoney({
  amount,
  warn,
  error = false,
}: {
  amount: number;
  warn: boolean;
  error?: boolean;
}) {
  const formatted = formatInvoiceMoney(amount);
  if (error) {
    return (
      <InvoiceWizardReviewOptionalMissing className="tabular-nums bg-destructive/15 text-destructive">
        {formatted}
      </InvoiceWizardReviewOptionalMissing>
    );
  }
  if (!warn) return <span className="tabular-nums">{formatted}</span>;
  return (
    <InvoiceWizardReviewOptionalMissing className="tabular-nums">{formatted}</InvoiceWizardReviewOptionalMissing>
  );
}

function ReviewPriceTotals({
  subtotal,
  discount,
  amountPaid,
  balance,
  showPayment,
}: {
  subtotal: number;
  discount: number;
  amountPaid: number;
  balance: number;
  showPayment: boolean;
}) {
  const { t } = useTranslation();
  const invoiceTotal = Math.round((subtotal - discount) * 100) / 100;
  const isNegativeBalance = balance < 0;

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{t("invoices.wizard.summary.subtotal")}</span>
        <ReviewWarningMoney amount={subtotal} warn={subtotal === 0} />
      </div>
      {discount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("invoices.wizard.summary.discount")}</span>
          <span className="tabular-nums">−{formatInvoiceMoney(discount)}</span>
        </div>
      ) : null}
      {showPayment ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("invoices.wizard.summary.payment")}</span>
          <ReviewWarningMoney amount={amountPaid} warn={amountPaid === 0} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-base font-semibold">
        <span>{showPayment ? t("invoices.wizard.summary.balanceDue") : t("invoices.wizard.summary.total")}</span>
        <ReviewWarningMoney
          amount={showPayment ? balance : invoiceTotal}
          warn={invoiceTotal === 0 || balance > 0}
          error={isNegativeBalance}
        />
      </div>
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
    pickupSourceLabel,
    subtotal,
    discount,
    amountPaid,
    lineItemRows,
  } = usePreviewLabels(values);
  const missingContactLabels = {
    missingPhoneLabel: t("invoices.wizard.review.noPhone"),
    missingAddressLabel: t("invoices.wizard.review.noAddress"),
  };
  const recordedPaymentAmount = paymentSummary?.registration?.amount ?? amountPaid;
  const paymentIsMissingOptional =
    Boolean(showPaymentSection) &&
    (!paymentSummary?.registration || paymentSummary.paymentSkipped || recordedPaymentAmount === 0);
  const zeroLabelCount = lineItemRows.filter((item) => resolveLineLabelCount(item) === 0).length;
  const zeroLabelsWarning =
    zeroLabelCount === 0
      ? null
      : t(
          zeroLabelCount === 1
            ? "invoices.wizard.review.zeroLabelsWarning"
            : "invoices.wizard.review.zeroLabelsWarning_plural",
          { count: zeroLabelCount },
        );

  return (
    <div
      id="invoice-wizard-print-area"
      className={isPhoneWizard ? "space-y-4 pb-2" : "divide-y divide-border px-5 py-2 sm:px-8"}
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
        variant={isPhoneWizard ? "phonePanel" : "default"}
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
                  {pickupFieldLabel}:{" "}
                  {values.pickupId ? (
                    pickupLabel
                  ) : (
                    <InvoiceWizardReviewOptionalMissing>{pickupLabel}</InvoiceWizardReviewOptionalMissing>
                  )}
                </p>
                <p>
                  {t("invoices.form.fields.pickupSource")}: {pickupSourceLabel}
                </p>
                <p>
                  {pickupAssignmentFieldLabel}: {pickupAssignmentLabel}
                </p>
                <p>
                  {t("invoices.form.fields.paymentLocation")}: {getPaymentLocationLabel(values.paymentLocation)}
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
        variant={isPhoneWizard ? "phonePanel" : "default"}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("invoices.wizard.review.sender")}</p>
            {values.sender ? (
              <CustomerContactSummary customer={values.sender} {...missingContactLabels} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.notSelected")}</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("invoices.wizard.review.receiver")}</p>
            {values.receiver ? (
              <CustomerContactSummary customer={values.receiver} {...missingContactLabels} />
            ) : (
              <p className="text-sm">
                <InvoiceWizardReviewOptionalMissing>
                  {t("invoices.wizard.review.noReceiver")}
                </InvoiceWizardReviewOptionalMissing>
              </p>
            )}
          </div>
        </div>
      </InvoiceWizardReviewSection>

      <InvoiceWizardReviewSection
        number={3}
        title={t("invoices.wizard.review.lineItems")}
        onEdit={onEditStep ? () => onEditStep(3) : undefined}
        variant={isPhoneWizard ? "phonePanel" : "default"}
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
            {isPhoneWizard ? (
              <div className="divide-y divide-border">
                {lineItemRows.map((item) => {
                  const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                  const label =
                    item.itemName.trim() ||
                    catalogItem?.description ||
                    t("invoices.wizard.summary.lineItem");
                  const unitPrice = Number(item.unitPrice) || 0;
                  const quantity = Number(item.quantity) || 0;
                  const lineTotal = resolveLineTotal(item);
                  return (
                    <article key={item.id} className="py-4 first:pt-2 last:pb-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                            {label}
                          </p>
                          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
                            <ReviewWarningMoney amount={unitPrice} warn={unitPrice === 0} /> x{" "}
                            {quantity || t("common.empty.dash")}
                          </p>
                          <div className="mt-1">
                            <ReviewLineItemLabels count={resolveLineLabelCount(item)} />
                          </div>
                        </div>
                        <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                          <ReviewWarningMoney amount={lineTotal} warn={lineTotal === 0} />
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <ul className="list-inside list-disc space-y-1">
                {lineItemRows.map((item) => {
                  const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                  const label =
                    item.itemName.trim() ||
                    catalogItem?.description ||
                    t("invoices.wizard.summary.lineItem");
                  const lineTotal = resolveLineTotal(item);
                  return (
                    <li key={item.id}>
                      {label} · {t("invoices.wizard.review.qty")} {item.quantity || "1"} ·{" "}
                      <ReviewWarningMoney amount={lineTotal} warn={lineTotal === 0} />
                      {resolveLineLabelCount(item) > 0 ? null : (
                        <>
                          {" · "}
                          <InvoiceWizardReviewOptionalMissing>
                            {t("invoices.wizard.review.noLabels")}
                          </InvoiceWizardReviewOptionalMissing>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </InvoiceWizardReviewSection>

      {showPaymentSection ? (
        <InvoiceWizardReviewSection
          number={4}
          title={t("invoices.wizard.review.dailyIncomePayment")}
          onEdit={onEditPayment}
          variant={isPhoneWizard ? "phonePanel" : "default"}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div
              className={
                paymentIsMissingOptional
                  ? "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                  : undefined
              }
            >
              {paymentSummary?.registration ? (
                <>
                  <p
                    className={
                      paymentIsMissingOptional
                        ? "font-medium text-amber-800 dark:text-amber-200"
                        : "font-medium text-foreground"
                    }
                  >
                    {paymentSummary.paymentSkipped && paymentSummary.registration.amount === 0
                      ? t("invoices.wizard.review.zeroPaymentRegistered")
                      : t("invoices.wizard.review.registrationConfirmed")}
                  </p>
                  <p
                    className={
                      paymentIsMissingOptional
                        ? "text-amber-800/80 dark:text-amber-200/80"
                        : "text-muted-foreground"
                    }
                  >
                    {paymentSummary.paymentSkipped && paymentSummary.registration.amount === 0
                      ? t("invoices.wizard.review.zeroPaymentRegisteredHint")
                      : t("invoices.wizard.review.initialPayment", {
                          amount: formatInvoiceMoney(paymentSummary.registration.amount),
                        })}
                  </p>
                </>
              ) : paymentSummary?.incomeStatementId ? (
                <>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {t("invoices.wizard.review.cuadreLinked")}
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-200/80">
                    {t("invoices.wizard.review.cuadreLinkedHint", {
                      id: paymentSummary.incomeStatementId,
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {t("invoices.wizard.review.paymentSkipped")}
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-200/80">
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
        variant={isPhoneWizard ? "phonePanel" : "default"}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.reviewIntro")}</p>
          {zeroLabelsWarning ? (
            <InvoiceWizardNotice
              tone="warning"
              variant="footer"
              message={zeroLabelsWarning}
              className="rounded-lg border print:hidden"
            />
          ) : null}

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">
              {t("invoices.wizard.review.yourItems")}
            </h4>
            {lineItemRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
            ) : (
              isPhoneWizard ? (
                <div className="divide-y divide-border">
                  {lineItemRows.map((item) => {
                    const catalogItem = catalogItems.find((entry) => entry.itemId === item.itemId);
                    const label =
                      item.itemName.trim() ||
                      catalogItem?.description ||
                      t("invoices.wizard.summary.lineItem");
                    const unitPrice = Number(item.unitPrice) || 0;
                    const quantity = Number(item.quantity) || 0;
                    const lineTotal = resolveLineTotal(item);

                    return (
                      <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                          <div className="min-w-0">
                            <p className="whitespace-normal break-words text-lg font-semibold leading-snug text-foreground">
                              {label}
                            </p>
                            <p className="mt-3 text-base tabular-nums text-muted-foreground">
                              <ReviewWarningMoney amount={unitPrice} warn={unitPrice === 0} /> x{" "}
                              {quantity || t("common.empty.dash")}
                            </p>
                            <div className="mt-1">
                              <ReviewLineItemLabels count={resolveLineLabelCount(item)} />
                            </div>
                          </div>
                          <p className="shrink-0 text-lg font-semibold tabular-nums text-foreground">
                            <ReviewWarningMoney amount={lineTotal} warn={lineTotal === 0} />
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[36rem] table-fixed text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="w-[44%] px-4 py-3 font-medium">{t("invoices.wizard.review.table.item")}</th>
                        <th className="w-[10%] px-4 py-3 font-medium">{t("invoices.wizard.review.table.qty")}</th>
                        <th className="w-[14%] px-4 py-3 font-medium">{t("invoices.wizard.review.table.labels")}</th>
                        <th className="w-[16%] px-4 py-3 font-medium">{t("invoices.wizard.review.table.unitPrice")}</th>
                        <th className="w-[16%] px-4 py-3 font-medium text-right">
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
                        const labelCount = resolveLineLabelCount(item);
                        const unitPrice = Number(item.unitPrice) || 0;
                        const lineTotal = resolveLineTotal(item);
                        return (
                          <tr key={item.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3 align-top">
                              <p className="whitespace-normal break-words font-medium leading-snug text-foreground">
                                {label}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                              {item.quantity || t("common.empty.dash")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                              {labelCount > 0 ? (
                                <span className="tabular-nums">{labelCount}</span>
                              ) : (
                                <InvoiceWizardReviewOptionalMissing>
                                  {t("invoices.wizard.review.noLabels")}
                                </InvoiceWizardReviewOptionalMissing>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                              <ReviewWarningMoney amount={unitPrice} warn={unitPrice === 0} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-right font-medium">
                              <ReviewWarningMoney amount={lineTotal} warn={lineTotal === 0} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
            <ReviewPriceTotals
              subtotal={subtotal}
              discount={discount}
              amountPaid={recordedPaymentAmount}
              balance={computeInvoiceBalance(subtotal, discount, recordedPaymentAmount)}
              showPayment={Boolean(showPaymentSection)}
            />
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
  const { t } = useTranslation();
  const isPhoneWizard = appearance === "phoneWizard";
  const isWizard = appearance === "wizard" || isPhoneWizard;
  const { subtotal, discount, amountPaid, balance, lineItemRows, catalogItems, containerLabel, pickupLabel, pickupFieldLabel, pickupAssignmentLabel, pickupAssignmentFieldLabel, pickupSourceLabel } =
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
          <PreviewField label={t("invoices.form.fields.paymentLocation")} value={getPaymentLocationLabel(values.paymentLocation)} />
          <PreviewField label={t("invoices.form.fields.pickupSource")} value={pickupSourceLabel} />
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
