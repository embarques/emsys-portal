"use client";

import { useMemo } from "react";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  buildInvoiceActivityTimeline,
  formatInvoiceActivityAction,
} from "@/lib/invoices/activity";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

type InvoiceActivitySectionProps = {
  invoice: Invoice;
};

export function InvoiceActivitySection({ invoice }: InvoiceActivitySectionProps) {
  const timeline = useMemo(() => buildInvoiceActivityTimeline(invoice), [invoice]);

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        Invoice activity ({timeline.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Creation, payments, edits, discounts, and comments on this invoice.
      </p>

      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No invoice activity yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Date created</th>
                <th className="px-3 py-2 font-medium">User created</th>
                <th className="px-3 py-2 font-medium">Date modified</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[...timeline].reverse().map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b last:border-0",
                    entry.success ? "bg-emerald-500/5" : "bg-destructive/5"
                  )}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {formatInvoiceCommentDateTime(entry.timestamp)}
                  </td>
                  <td className="px-3 py-2 text-xs">{entry.performedBy}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">—</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {formatInvoiceActivityAction(entry.action)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
