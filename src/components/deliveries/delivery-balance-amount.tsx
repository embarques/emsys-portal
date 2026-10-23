"use client";

import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { useDeliveryRouteRate } from "@/lib/deliveries/hooks/use-delivery-route-rate";
import { toDopAmount, type AssignedDeliveryBarcode } from "@/lib/deliveries/types";
import { formatInvoiceMoney, getInvoiceBalanceMoneyClass } from "@/lib/invoices/display";
import { cn } from "@/lib/utils";

/** Invoice balance in USD with its DOP equivalent at the route exchange rate. */
export function DeliveryBalanceAmount({ balance, rate, className }: { balance: number; rate?: number; className?: string }) {
  const dop = toDopAmount(balance, rate);
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className={getInvoiceBalanceMoneyClass(balance)}>{formatInvoiceMoney(balance)}</span>
      {dop != null ? <span className="text-xs tabular-nums text-muted-foreground">{formatDailyIncomeMoney(dop, "DOP")}</span> : null}
    </span>
  );
}

export function DeliveryRowBalance({ row }: { row: AssignedDeliveryBarcode }) {
  const rate = useDeliveryRouteRate(row);
  if (row.invoiceBalance == null) return null;
  return <DeliveryBalanceAmount balance={row.invoiceBalance} rate={rate} />;
}
