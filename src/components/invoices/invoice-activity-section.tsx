"use client";

import { useMemo } from "react";
import { ClipboardList } from "lucide-react";

import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import { buildInvoiceActivityTimeline } from "@/lib/invoices/activity";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceActivitySectionProps = {
  invoice: Invoice;
};

export function InvoiceActivitySection({ invoice }: InvoiceActivitySectionProps) {
  const { t } = useTranslation();
  const timeline = useMemo(() => buildInvoiceActivityTimeline(invoice), [invoice]);
  const sortedTimeline = [...timeline].reverse();

  return (
    <InvoiceViewCollapsibleSection
      title={t("invoices.view.activity.title", { count: timeline.length })}
      description={t("invoices.view.activity.description")}
      icon={ClipboardList}
      count={timeline.length}
    >
      {sortedTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.view.activity.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {sortedTimeline.map((entry) => (
            <InvoiceViewListItem
              key={entry.id}
              className={cn(entry.success ? "bg-emerald-500/5" : "bg-destructive/5")}
            >
              <InvoiceViewField
                label={t("invoices.view.activity.fields.dateTime")}
                value={formatInvoiceCommentDateTime(entry.timestamp)}
              />
              <InvoiceViewField
                label={t("invoices.view.activity.fields.createdBy")}
                value={entry.performedBy}
              />
              <InvoiceViewField
                label={t("invoices.view.activity.fields.description")}
                value={entry.message}
              />
            </InvoiceViewListItem>
          ))}
        </ul>
      )}
    </InvoiceViewCollapsibleSection>
  );
}
