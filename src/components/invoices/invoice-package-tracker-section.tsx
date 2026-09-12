"use client";

import { useMemo } from "react";
import { PackageSearch } from "lucide-react";

import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import { formatLabelTimestamp } from "@/lib/labels/display";
import { buildInvoicePackageTrackerEntries } from "@/lib/invoices/package-tracker";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoicePackageTrackerSectionProps = {
  invoice: Invoice;
};

export function InvoicePackageTrackerSection({ invoice }: InvoicePackageTrackerSectionProps) {
  const { t } = useTranslation();

  const timeline = useMemo(() => buildInvoicePackageTrackerEntries(invoice), [invoice]);

  const sortedTimeline = [...timeline].reverse();

  return (
    <InvoiceViewCollapsibleSection
      title={t("invoices.view.packageTracker.title", { count: timeline.length })}
      description={t("invoices.view.packageTracker.description")}
      icon={PackageSearch}
      count={timeline.length}
    >
      {sortedTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.view.packageTracker.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {sortedTimeline.map((entry) => (
            <InvoiceViewListItem
              key={entry.id}
              className={cn(entry.success ? "bg-emerald-500/5" : "bg-destructive/5")}
            >
              <InvoiceViewField
                label={t("invoices.view.packageTracker.fields.dateTime")}
                value={formatLabelTimestamp(entry.timestamp)}
              />
              <InvoiceViewField
                label={t("invoices.view.packageTracker.fields.createdBy")}
                value={entry.performedBy}
              />
              <InvoiceViewField
                label={t("invoices.view.packageTracker.fields.description")}
                value={entry.description}
              />
            </InvoiceViewListItem>
          ))}
        </ul>
      )}
    </InvoiceViewCollapsibleSection>
  );
}
