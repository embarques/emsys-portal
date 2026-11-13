"use client";

import type { ReactNode } from "react";
import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { isAutoClearEligible } from "@/lib/accounting/daily-income/auto-clear";
import { isAutoReconcileEligible } from "@/lib/accounting/daily-income/auto-reconcile";
import { inventoryHoldersFromValues } from "@/lib/accounting/daily-income/inventory-change";
import { isCashPaymentMethod, isCheckPaymentMethod, requiresBankAccount, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { isCashAccountSelectable } from "@/lib/accounting/daily-income/payment-accounts";
import { getTransactionStepLabelKey, hasPartiesStep, hasPaymentDetailsStep, isExpensePaidByMethod, type TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import { useTranslation } from "@/lib/i18n";

type Props = {
  values: DailyIncomeJournalValues;
  compact?: boolean;
  currency?: string;
  onEdit?: (step: TransactionFormStep) => void;
};

export function TransactionReview({ values: v, onEdit, compact = false, currency }: Props) {
  const { t } = useTranslation();
  const inventory = v.transactionType === "INVENTORY";
  const registerInvoice = v.transactionType === "INITIAL-PAYMENT";
  const paymentDetails = hasPaymentDetailsStep(v.transactionType);
  const expensePaidByMethod = isExpensePaidByMethod(v.transactionType);
  const money = (value: number | undefined) => value == null || !Number.isFinite(value) ? undefined : currency ? formatDailyIncomeMoney(value, currency) : formatAccountingMoney(value);
  const dispatched = inventory && v.inventoryDirection === "dispatched";
  const holders = dispatched ? inventoryHoldersFromValues(v) : null;
  const holderNames = holders ? [holders.vehicle?.name, ...holders.employees.map((employee) => employee.name)].filter(Boolean).join(", ") : undefined;
  const invoiceDetailRows: [string, string | undefined][] = [
    ["accounting.dailyIncome.form.fields.invoice", v.autoGenerateInvoiceNumber ? t("invoices.form.autoNumber.assignedOnSave") : v.invoiceNumber],
    ["accounting.dailyIncome.form.fields.senderClient", v.includeSender ? v.senderName : undefined],
    ["accounting.dailyIncome.form.fields.receiverClient", v.includeReceiver ? v.receiverName : undefined],
  ];
  const amountRows: [string, string | undefined][] = [
    [registerInvoice ? "accounting.dailyIncome.form.invoiceSummary.total" : "accounting.dailyIncome.form.fields.cost", money(v.invoiceCost)],
    ["accounting.dailyIncome.form.invoiceSummary.discount", registerInvoice ? money(compact ? v.invoiceDiscount : v.invoiceDiscount ?? 0) : undefined],
    [registerInvoice ? "accounting.dailyIncome.form.invoiceSummary.paid" : "accounting.dailyIncome.form.fields.amount", inventory ? undefined : money(v.amount)],
    ["accounting.dailyIncome.form.fields.balance", registerInvoice && v.invoiceCost != null ? money(v.invoiceCost - (v.invoiceDiscount ?? 0) - (v.amount ?? 0)) : undefined],
  ];
  const groups: { step: TransactionFormStep; rows: [string, string | number | undefined][]; invoiceSummary?: { invoice: [string, string | undefined]; payment: [string, string | undefined][] } }[] = [
    {
      step: "assignment", rows: [
        ["accounting.dailyIncome.form.fields.assignedTo", inventory ? undefined : v.routeName || v.employeeName || v.routeId || v.employeeId || (compact ? undefined : t("accounting.dailyIncome.form.creatorAssignee"))],
        ["accounting.dailyIncome.form.fields.responsibleSupervisor", !inventory && v.routeId ? v.supervisorName || v.supervisorId : undefined],
        ["accounting.dailyIncome.form.fields.inventoryDirection", inventory && v.inventoryDirection ? t(`accounting.dailyIncome.form.inventory.${v.inventoryDirection}`) : undefined],
        ["inventory.form.fields.supplier", inventory ? v.inventorySupplierName : undefined],
        ["accounting.dailyIncome.form.fields.route", dispatched ? v.routeName || v.routeId : undefined],
        ["accounting.dailyIncome.form.fields.inventoryHolders", holderNames],
      ]
    },
    {
      step: "amounts",
      invoiceSummary: registerInvoice ? { invoice: invoiceDetailRows[0], payment: amountRows } : undefined,
      rows: [
        ...(registerInvoice ? [] : [invoiceDetailRows[0]]),
        ...(v.transactionType === "TRANSFER"
          ? [
            ["accounting.dailyIncome.form.fields.transferFrom", v.sourceAccountName],
            ["accounting.dailyIncome.form.fields.transferTo", v.accountName],
          ] as [string, string | undefined][]
          : [
            ["accounting.dailyIncome.form.fields.account", v.accountName],
            ["accounting.dailyIncome.form.fields.sourceAccount", expensePaidByMethod ? undefined : v.sourceAccountName],
          ] as [string, string | undefined][]),
        ...(registerInvoice ? [] : [...amountRows, ...invoiceDetailRows.slice(1)]),
        ["inventory.form.fields.item", inventory ? v.inventoryItemName : undefined],
        ["inventory.form.fields.quantity", inventory ? v.inventoryQuantity : undefined],
        ["accounting.dailyIncome.form.fields.unitPrice", inventory ? money(v.inventoryUnitPrice) : undefined],
        ["accounting.dailyIncome.form.fields.total", inventory ? money(v.inventoryTotal) : undefined],
        ["accounting.dailyIncome.form.fields.autoReconcile", v.autoReconcile && isAutoReconcileEligible(v) ? t("accounting.dailyIncome.form.fields.autoReconcileReviewValue") : undefined],
        ["accounting.dailyIncome.form.fields.description", !inventory && !paymentDetails ? v.description : undefined],
      ]
    },
    ...(paymentDetails ? [{
      step: "payment" as const, rows: [
        ["accounting.dailyIncome.form.fields.paymentMethod", v.paymentMethodName],
        ["accounting.dailyIncome.form.fields.bankAccount", requiresBankAccount(v.paymentMethodName) ? v.paymentAccountName : undefined],
        ["accounting.dailyIncome.form.fields.cashAccount", isCashAccountSelectable(v.transactionType, isCashPaymentMethod(v.paymentMethodName)) ? v.paymentAccountName : undefined],
        ["accounting.dailyIncome.form.fields.sourceAccount", expensePaidByMethod ? v.sourceAccountName : undefined],
        ["accounting.dailyIncome.form.fields.checkNumber", isCheckPaymentMethod(v.paymentMethodName) ? v.checkNumber : undefined],
        ["accounting.dailyIncome.form.fields.externalReferenceNumber", isCheckPaymentMethod(v.paymentMethodName) ? undefined : v.externalReferenceNumber],
        ["accounting.dailyIncome.form.fields.autoClear", v.autoClear && isAutoClearEligible(v) ? t("accounting.dailyIncome.form.fields.autoClearReviewValue") : undefined],
        ["accounting.dailyIncome.form.fields.referenceNumber", registerInvoice ? undefined : v.refNumberMode === "custom" ? v.refNumber : t("accounting.dailyIncome.form.fields.referenceNumberModeSystem")],
        ["accounting.dailyIncome.form.fields.description", v.description],
      ] as [string, string | undefined][]
    }] : []),
    ...(hasPartiesStep(v.transactionType) ? [{
      step: "parties" as const, rows: [
        ["accounting.dailyIncome.form.fields.senderClient", v.includeSender ? v.senderName : compact ? undefined : t("accounting.dailyIncome.form.fields.partySkipped")],
        ["accounting.dailyIncome.form.fields.receiverClient", v.includeReceiver ? v.receiverName : compact ? undefined : t("accounting.dailyIncome.form.fields.partySkipped")],
      ] as [string, string | undefined][]
    }] : []),
  ];
  if (compact) {
    const rows = groups.flatMap((group) => [
      ...(group.invoiceSummary ? [group.invoiceSummary.invoice, ...group.invoiceSummary.payment] : []),
      ...group.rows,
    ]).filter(([, value]) => value != null && (typeof value !== "string" || value.trim() !== "") && (typeof value !== "number" || Number.isFinite(value)));
    // Sender/receiver can also occur in the parties section of the full review.
    const uniqueRows = rows.filter(([label], index) => rows.findIndex(([key]) => key === label) === index);
    return <CurrentTransactionSummary typeLabel={transactionTypeLabel(v.transactionType, t)} rows={uniqueRows.map(([label, value]) => [t(label), value])} />;
  }
  return (
    <div className="space-y-4">
      {groups.map(({ step, rows, invoiceSummary }) => {
        const visibleRows = rows.filter(([, value]) => value !== undefined && value !== "");
        return (
          <FormSection key={step} variant="card" title={t(getTransactionStepLabelKey(step, v.transactionType))} action={onEdit ? <Button type="button" size="sm" variant="outline" aria-label={`${t("common.actions.edit")}: ${t(getTransactionStepLabelKey(step, v.transactionType))}`} onClick={() => onEdit(step)}>{t("common.actions.edit")}</Button> : undefined}>
            <div className="space-y-4">
              {invoiceSummary ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <dl>
                    <ReviewField label={t(invoiceSummary.invoice[0])} value={invoiceSummary.invoice[1] || t("common.empty.dash")} />
                  </dl>
                  <dl className="grid grid-cols-2 gap-4 sm:col-span-2">
                    {invoiceSummary.payment.map(([label, value]) => <ReviewField key={label} label={t(label)} value={value || t("common.empty.dash")} />)}
                  </dl>
                </div>
              ) : null}
              {visibleRows.length > 0 ? (
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleRows.map(([label, value]) => <ReviewField key={label} label={t(label)} value={value} />)}
                </dl>
              ) : null}
            </div>
          </FormSection>
        );
      })}
    </div>
  );
}

/** Compact unsaved-transaction summary shown in the session side panel. */
export function CurrentTransactionSummary({ typeLabel, rows }: { typeLabel: string; rows: [string, ReactNode][] }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("accounting.dailyIncome.sessionPanel.currentTitle")} className="border-b bg-muted/30 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("accounting.dailyIncome.sessionPanel.currentTitle")}</h3>
        <span className="text-xs text-muted-foreground">{t("accounting.dailyIncome.sessionPanel.unsaved")}</span>
      </div>
      <p className="mb-3 text-xs font-medium text-muted-foreground">{typeLabel}</p>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 text-xs">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words whitespace-pre-wrap text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReviewField({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap text-sm font-medium">{value}</dd>
    </div>
  );
}
