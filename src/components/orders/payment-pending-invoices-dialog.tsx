"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInvoiceDate, formatInvoiceMoney } from "@/lib/invoices/display";
import { sumInvoiceBalances } from "@/lib/invoices/sender-pending-invoices";
import { getInvoiceBalanceAmount, type Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PaymentPendingInvoicesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderName?: string;
  invoices: Invoice[];
  isLoading: boolean;
  isError: boolean;
  onSave: (selected: Invoice[]) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function PaymentPendingInvoicesDialog({
  open,
  onOpenChange,
  senderName,
  invoices,
  isLoading,
  isError,
  onSave,
  onCloseAutoFocus,
}: PaymentPendingInvoicesDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[70] sm:max-w-xl" data-enter-navigation="ignore" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t("orders.comments.pendingInvoices.title")}</DialogTitle>
          <DialogDescription>
            {senderName
              ? t("orders.comments.pendingInvoices.descriptionWithSender", { name: senderName })
              : t("orders.comments.pendingInvoices.description")}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PendingInvoicesSelection
            invoices={invoices}
            isLoading={isLoading}
            isError={isError}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PendingInvoicesSelection({
  invoices,
  isLoading,
  isError,
  onCancel,
  onSave,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  isError: boolean;
  onCancel: () => void;
  onSave: (selected: Invoice[]) => void;
}) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selected = invoices.filter((invoice) => selectedIds.has(invoice.invoiceId));
  const allSelected = invoices.length > 0 && selected.length === invoices.length;

  function toggle(invoiceId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(invoices.map((invoice) => invoice.invoiceId)) : new Set());
  }

  let body;
  if (isLoading) {
    body = (
      <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("orders.comments.pendingInvoices.loading")}
      </p>
    );
  } else if (isError) {
    body = (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-center text-sm text-destructive" role="alert">
        {t("orders.comments.pendingInvoices.error")}
      </p>
    );
  } else if (invoices.length === 0) {
    body = (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        {t("orders.comments.pendingInvoices.empty")}
      </p>
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-lg border">
        <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={allSelected}
            ref={(element) => {
              if (element) element.indeterminate = selected.length > 0 && !allSelected;
            }}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          <span className="flex-1">{t("orders.comments.pendingInvoices.selectAll")}</span>
          <span>{t("orders.comments.pendingInvoices.balance")}</span>
        </label>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {invoices.map((invoice) => {
            const checked = selectedIds.has(invoice.invoiceId);
            return (
              <li key={invoice.invoiceId}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40", checked && "bg-primary/5")}>
                  <input type="checkbox" className="size-4" checked={checked} onChange={() => toggle(invoice.invoiceId)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {t("orders.comments.pendingInvoices.invoiceNumber", { number: invoice.invoiceNumber })}
                    </span>
                    {invoice.date ? (
                      <span className="block text-xs text-muted-foreground">{formatInvoiceDate(invoice.date)}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatInvoiceMoney(getInvoiceBalanceAmount(invoice))}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <>
      {body}
      <DialogFooter className="items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.length > 0
            ? t("orders.comments.pendingInvoices.selectedSummary", {
                count: selected.length,
                total: formatInvoiceMoney(sumInvoiceBalances(selected)),
              })
            : null}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" disabled={selected.length === 0} onClick={() => onSave(selected)}>
            {t("orders.comments.pendingInvoices.addToComment")}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
