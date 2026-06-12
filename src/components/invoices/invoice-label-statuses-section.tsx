"use client";

import { useMemo } from "react";
import { Barcode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UniformPillWidthProvider, UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
import {
  getLabelStatusBadgeClass,
  getLabelStatusLabel,
  truncateBarcode,
} from "@/lib/labels/display";
import type { ShipmentLabel } from "@/lib/labels/types";
import { useLabelsStore } from "@/lib/labels/use-labels-store";
import type { Invoice } from "@/lib/invoices/types";

type InvoiceLabelStatusesSectionProps = {
  invoice: Invoice;
};

function groupLabelsByLineItem(labels: ShipmentLabel[]) {
  const groups = new Map<string, ShipmentLabel[]>();

  labels.forEach((label) => {
    const existing = groups.get(label.invoiceLineItemId) ?? [];
    groups.set(label.invoiceLineItemId, [...existing, label]);
  });

  return groups;
}

export function InvoiceLabelStatusesSection({ invoice }: InvoiceLabelStatusesSectionProps) {
  const { labels } = useLabelsStore();

  const invoiceLabels = useMemo(
    () => labels.filter((label) => label.invoiceId === invoice.invoiceId),
    [invoice.invoiceId, labels]
  );

  const groupedLabels = useMemo(() => groupLabelsByLineItem(invoiceLabels), [invoiceLabels]);

  const expectedLabelCount = invoice.lineItems.reduce((sum, item) => sum + item.labelCount, 0);

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Barcode className="h-3.5 w-3.5" />
        Label barcodes ({invoiceLabels.length}
        {expectedLabelCount > 0 ? ` / ${expectedLabelCount} expected` : ""})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Status for each generated barcode on this invoice.
      </p>

      {invoiceLabels.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {expectedLabelCount > 0
            ? "No labels generated yet. Generate labels from the Labels tab."
            : "This invoice has no label counts on its line items."}
        </p>
      ) : (
        <UniformPillWidthProvider resetKey={invoiceLabels.map((label) => label.labelId).join(",")}>
          <div className="mt-4 space-y-4">
          {invoice.lineItems
            .filter((lineItem) => lineItem.labelCount > 0)
            .map((lineItem) => {
              const lineLabels = groupedLabels.get(lineItem.id) ?? [];

              return (
                <div key={lineItem.id} className="rounded-lg border bg-background">
                  <div className="border-b px-3 py-2">
                    <p className="text-sm font-medium">{lineItem.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lineLabels.length} of {lineItem.labelCount} label
                      {lineItem.labelCount === 1 ? "" : "s"} generated
                    </p>
                  </div>
                  {lineLabels.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Not generated yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[280px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Barcode</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineLabels.map((label) => (
                            <tr key={label.labelId} className="border-b last:border-0">
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {label.labelSequence}/{label.totalLabels}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs" title={label.barcode}>
                                {truncateBarcode(label.barcode)}
                              </td>
                              <td className="px-3 py-2">
                                <UniformWidthPill columnKey="status">
                                  <Badge className={getLabelStatusBadgeClass(label.status)}>
                                    {getLabelStatusLabel(label.status)}
                                  </Badge>
                                </UniformWidthPill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

          {invoiceLabels.some(
            (label) => !invoice.lineItems.some((item) => item.id === label.invoiceLineItemId)
          ) ? (
            <div className="rounded-lg border bg-background">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-medium">Other generated labels</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Barcode</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLabels
                      .filter(
                        (label) =>
                          !invoice.lineItems.some((item) => item.id === label.invoiceLineItemId)
                      )
                      .map((label) => (
                        <tr key={label.labelId} className="border-b last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {label.labelSequence}/{label.totalLabels}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs" title={label.barcode}>
                            {truncateBarcode(label.barcode)}
                          </td>
                          <td className="px-3 py-2">
                            <UniformWidthPill columnKey="status">
                              <Badge className={getLabelStatusBadgeClass(label.status)}>
                                {getLabelStatusLabel(label.status)}
                              </Badge>
                            </UniformWidthPill>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          </div>
        </UniformPillWidthProvider>
      )}
    </div>
  );
}
