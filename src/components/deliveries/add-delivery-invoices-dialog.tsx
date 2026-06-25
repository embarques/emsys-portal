"use client";

import { Eye, PackagePlus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import {
  buildInvoiceListParams,
  type Invoice,
} from "@/lib/invoices/types";
import { formatInvoiceMoney } from "@/lib/invoices/display";

type AddDeliveryInvoicesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting?: boolean;
  onSubmit: (invoices: Invoice[]) => void;
  onPreviewInvoice?: (invoice: Invoice) => void;
};

export function AddDeliveryInvoicesDialog({
  open,
  onOpenChange,
  isSubmitting = false,
  onSubmit,
  onPreviewInvoice,
}: AddDeliveryInvoicesDialogProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selected, setSelected] = useState<Invoice[]>([]);

  const invoiceParams = useMemo(
    () =>
      buildInvoiceListParams({
        page: 1,
        limit: 50,
        query: debouncedQuery,
        rows: [],
        paymentLocation: "all",
      }),
    [debouncedQuery],
  );

  const invoicesQuery = useInvoices(invoiceParams, { enabled: open });
  const invoices = invoicesQuery.data?.items ?? [];

  function addInvoice(invoice: Invoice) {
    setSelected((current) =>
      current.some((entry) => entry.invoiceId === invoice.invoiceId)
        ? current
        : [...current, invoice],
    );
  }

  function removeInvoice(invoiceId: string) {
    setSelected((current) => current.filter((invoice) => invoice.invoiceId !== invoiceId));
  }

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setSelected([]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Add invoice packages</DialogTitle>
          <DialogDescription>
            Select invoices to generate delivery package labels for this delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_360px]">
          <div className="min-h-0 border-r">
            <div className="border-b p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search invoices..."
                />
              </div>
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              {invoicesQuery.isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading invoices...</p>
              ) : invoices.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No invoices found.</p>
              ) : (
                <div className="divide-y">
                  {invoices.map((invoice) => (
                    <div key={invoice.invoiceId} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.sender.name} to {invoice.receiver.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.lineItems.length} items · {formatInvoiceMoney(invoice.cost ?? 0)}
                        </p>
                      </div>
                      {onPreviewInvoice ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onPreviewInvoice(invoice)}
                          aria-label="Preview invoice"
                        >
                          <Eye className="size-4" />
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => addInvoice(invoice)}>
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 bg-muted/30">
            <div className="border-b p-4">
              <p className="text-sm font-medium">Selected invoices</p>
              <p className="text-xs text-muted-foreground">{selected.length} ready to add</p>
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              {selected.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Select invoices from the list.</p>
              ) : (
                <div className="divide-y">
                  {selected.map((invoice) => (
                    <div key={invoice.invoiceId} className="flex items-center gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.lineItems.reduce((sum, item) => sum + Math.max(item.labelCount, item.quantity), 0)} labels
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvoice(invoice.invoiceId)}
                        aria-label="Remove invoice"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(selected)}
            disabled={selected.length === 0 || isSubmitting}
          >
            <PackagePlus className="size-4" />
            {isSubmitting ? "Adding..." : "Add packages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
