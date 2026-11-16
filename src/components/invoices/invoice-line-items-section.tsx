"use client";

import { ClipboardList } from "lucide-react";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

function isFilled(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

export function InvoiceLineItemsSection({ lineItems }: { lineItems: readonly InvoiceLineItem[] }) {
  const { t } = useTranslation();
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.wizard.review.lineItems")}
      icon={ClipboardList}
    >
      {lineItems.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="px-3 py-2 font-medium">
                  {t("invoices.form.lineItems.columns.description")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.form.lineItems.columns.quantity")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.form.lineItems.columns.labels")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.form.lineItems.columns.unitPrice")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.form.lineItems.columns.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => {
                const description = isFilled(item.itemName)
                  ? item.itemName
                  : isFilled(item.description)
                    ? item.description
                    : "";

                return (
                  <tr key={item.id} className="border-b last:border-b-0 even:bg-muted/25">
                    <td className="min-w-[8rem] px-3 py-2 font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                      {description || empty}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                      {item.labelCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                      {formatInvoiceMoney(item.unitPrice)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-foreground">
                      {formatInvoiceMoney(item.lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </RecordViewSheetSection>
  );
}
