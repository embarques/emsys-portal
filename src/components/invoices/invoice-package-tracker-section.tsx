"use client";

import { useMemo } from "react";
import { PackageSearch } from "lucide-react";

import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import { buildInvoiceLabelActivityTimeline, formatLabelTimestamp } from "@/lib/labels/display";
import { getMockInvoicePackageTrackerEntries } from "@/lib/invoices/package-tracker";
import { useLabelsStore } from "@/lib/labels/use-labels-store";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoicePackageTrackerSectionProps = {
  invoice: Invoice;
};

export function InvoicePackageTrackerSection({ invoice }: InvoicePackageTrackerSectionProps) {
  const { t } = useTranslation();
  const { labels, activityLog } = useLabelsStore();

  const timeline = useMemo(() => {
    const fromStore = buildInvoiceLabelActivityTimeline(invoice, activityLog, labels);
    if (fromStore.length > 0) return fromStore;
    return getMockInvoicePackageTrackerEntries(invoice);
  }, [activityLog, invoice, labels]);

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
                value={"message" in entry ? entry.message : entry.description}
              />
            </InvoiceViewListItem>
          ))}
        </ul>
      )}
    </InvoiceViewCollapsibleSection>
  );
}
