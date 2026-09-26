"use client";

import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { isCheckPaymentMethod, requiresBankAccount, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { getTransactionStepLabelKey, type TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import { useTranslation } from "@/lib/i18n";

type Props = {
  values: DailyIncomeJournalValues;
  onEdit?: (step: TransactionFormStep) => void;
};

export function TransactionReview({ values: v, onEdit }: Props) {
  const { t } = useTranslation();
  const inventory = v.transactionType === "INVENTORY";
  const money = (value: number | undefined) => value == null ? undefined : formatAccountingMoney(value);
  const groups: { step: TransactionFormStep; rows: [string, string | number | undefined][] }[] = [
    {
      step: "assignment", rows: [
        ["accounting.dailyIncome.form.fields.assignedTo", v.routeName || v.employeeName || v.routeId || v.employeeId],
        ["accounting.dailyIncome.form.fields.inventoryDirection", inventory && v.inventoryDirection ? t(`accounting.dailyIncome.form.inventory.${v.inventoryDirection}`) : undefined],
        ["inventory.form.fields.supplier", inventory ? v.inventorySupplierName : undefined],
      ]
    },
    {
      step: "amounts", rows: [
        ["accounting.dailyIncome.form.fields.invoice", v.invoiceNumber],
        ["accounting.dailyIncome.form.fields.account", v.accountName],
        ["accounting.dailyIncome.form.fields.sourceAccount", v.sourceAccountName],
        ["accounting.dailyIncome.form.fields.cost", money(v.invoiceCost)],
        ["accounting.dailyIncome.form.fields.amount", inventory ? undefined : money(v.amount)],
        ["accounting.dailyIncome.form.fields.balance", v.transactionType === "INITIAL-PAYMENT" && v.invoiceCost != null ? money(v.invoiceCost - (v.amount ?? 0)) : undefined],
        ["accounting.dailyIncome.form.fields.senderClient", v.includeSender ? v.senderName : undefined],
        ["accounting.dailyIncome.form.fields.receiverClient", v.includeReceiver ? v.receiverName : undefined],
        ["inventory.form.fields.item", inventory ? v.inventoryItemName : undefined],
        ["inventory.form.fields.quantity", inventory ? v.inventoryQuantity : undefined],
        ["accounting.dailyIncome.form.fields.unitPrice", inventory ? money(v.inventoryUnitPrice) : undefined],
        ["accounting.dailyIncome.form.fields.total", inventory ? money(v.inventoryTotal) : undefined],
      ]
    },
    ...(!inventory ? [{
      step: "payment" as const, rows: [
        ["accounting.dailyIncome.form.fields.paymentMethod", v.paymentMethodName],
        ["accounting.dailyIncome.form.fields.bankAccount", requiresBankAccount(v.paymentMethodName) ? v.paymentAccountName : undefined],
        ["accounting.dailyIncome.form.fields.checkNumber", isCheckPaymentMethod(v.paymentMethodName) ? v.checkNumber : undefined],
        ["accounting.dailyIncome.form.fields.externalReferenceNumber", isCheckPaymentMethod(v.paymentMethodName) ? undefined : v.externalReferenceNumber],
        ["accounting.dailyIncome.form.fields.referenceNumber", v.refNumberMode === "custom" ? v.refNumber : t("accounting.dailyIncome.form.fields.referenceNumberModeSystem")],
        ["accounting.dailyIncome.form.fields.description", v.description],
      ] as [string, string | undefined][]
    }] : []),
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.wizard.workflow.reviewHint")}</p>
      {groups.map(({ step, rows }) => (
        <FormSection key={step} variant="card" title={t(getTransactionStepLabelKey(step, v.transactionType))} action={onEdit ? <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(step)}>{t("common.actions.edit")}</Button> : undefined}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.filter(([, value]) => value !== undefined && value !== "").map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t(label)}</dt>
                <dd className="mt-1 break-words whitespace-pre-wrap text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </FormSection>
      ))}
    </div>
  );
}
