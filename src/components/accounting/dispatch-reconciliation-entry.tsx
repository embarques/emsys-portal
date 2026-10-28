"use client";

import { InventoryConfirmationPanel } from "@/components/inventory/inventory-confirmation-panel";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryMinor } from "@/lib/inventory/display";
import { useConfirmationActions } from "@/lib/inventory/hooks/use-confirmation-actions";
import type { DispatchReconciliation, ReconciliationStatus } from "@/lib/inventory/pending-dispatches/types";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";

const RECONCILIATION_PARTIES = ["WAREHOUSE", "CUSTODIAN"] as const;

const STATUS_CLASSES: Record<ReconciliationStatus, string> = {
  PENDING_CONFIRMATION: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  CONFIRMED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "border-destructive/40 bg-destructive/5 text-destructive",
};

type DispatchReconciliationEntryProps = {
  entry: DispatchReconciliation;
  itemNames: Map<string, string>;
  formatDateTime: (iso?: string) => string;
  disabled: boolean;
  onAction: (entry: DispatchReconciliation, action: ConfirmationActionOption) => void;
};

/** One submitted reconciliation: outcomes, payments and the warehouse / custodian confirmations. */
export function DispatchReconciliationEntry({ entry, itemNames, formatDateTime, disabled, onAction }: DispatchReconciliationEntryProps) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.pendingInventory.dialog.${key}`, values);
  const isPending = entry.status === "PENDING_CONFIRMATION";
  const actions = useConfirmationActions(isPending ? entry : null, RECONCILIATION_PARTIES);

  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {[formatDateTime(entry.occurredAt ?? entry.recordedAt), entry.performedBy?.name].filter(Boolean).join(" · ")}
        </p>
        <Badge variant="outline" className={STATUS_CLASSES[entry.status]}>{text(`statuses.${entry.status}`)}</Badge>
      </div>
      <ul className="space-y-0.5">
        {entry.lines.map((line, index) => (
          <li key={`${line.dispatchLineId}-${line.outcome}-${index}`}>
            {text("historyLine", {
              outcome: t(`accounting.pendingInventory.outcomes.${line.outcome}`),
              quantity: line.quantity,
              item: line.itemName || itemNames.get(line.dispatchLineId) || "—",
            })}
            {line.revenueMinor != null ? ` · ${formatInventoryMinor(line.revenueMinor)}` : ""}
            {line.damageResolution ? ` · ${t(`accounting.pendingInventory.resolutions.${line.damageResolution}`)}` : ""}
          </li>
        ))}
      </ul>
      {entry.payments.length ? (
        <ul className="space-y-0.5 text-muted-foreground">
          {entry.payments.map((payment, index) => (
            <li key={`${payment.paymentMethod.id}-${index}`}>
              {[
                `${payment.paymentMethod.name} ${formatInventoryMinor(payment.amountMinor)}`,
                payment.paymentAccount?.name,
                payment.paymentReference ? text("checkNumberValue", { number: payment.paymentReference }) : "",
                payment.externalReferenceNumber,
              ].filter(Boolean).join(" · ")}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.creditMinor > 0 ? (
        <p className="text-muted-foreground">{text("onCredit", { amount: formatInventoryMinor(entry.creditMinor) })}</p>
      ) : null}
      {entry.incomeEmployee?.name ? <p className="text-muted-foreground">{text("incomeTo", { name: entry.incomeEmployee.name })}</p> : null}
      {entry.notes ? <p className="text-muted-foreground">{entry.notes}</p> : null}
      {entry.status !== "CONFIRMED" || entry.confirmations.warehouse || entry.confirmations.custodian ? (
        <InventoryConfirmationPanel
          state={entry}
          parties={RECONCILIATION_PARTIES}
          pending={isPending}
          actions={actions}
          disabled={disabled}
          onAction={(action) => onAction(entry, action)}
        />
      ) : null}
    </li>
  );
}
