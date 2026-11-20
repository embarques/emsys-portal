"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInvoiceDate, formatInvoiceMoney } from "@/lib/invoices/display";
import { sumInvoiceBalances } from "@/lib/invoices/sender-pending-invoices";
import { getInvoiceBalanceAmount, type Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
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
      <CompactActionDialogContent
        className="sm:max-w-xl"
        data-enter-navigation="ignore"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("orders.comments.pendingInvoices.title")}</DialogTitle>
          <DialogDescription className="text-foreground/80">
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
      </CompactActionDialogContent>
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

  const invoiceIds = invoices.map((invoice) => invoice.invoiceId);
  const selectedIdList = Array.from(selectedIds);
  const selected = invoices.filter((invoice) => selectedIds.has(invoice.invoiceId));
  const allSelected = invoices.length > 0 && selected.length === invoices.length;
  const othersAvailable = canSelectAllOthers(invoiceIds, selectedIdList);

  function toggle(invoiceId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(invoiceIds) : new Set());
  }

  function selectOthers() {
    setSelectedIds(new Set(selectAllOthers(invoiceIds, selectedIdList)));
  }

  let body;
  if (isLoading) {
    body = (
      <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-6 text-sm text-foreground/75">
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
      <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-sm text-foreground/75">
        {t("orders.comments.pendingInvoices.empty")}
      </p>
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-lg border border-input">
        <div className="flex items-center gap-3 border-b border-input bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground/75">
          <label className="flex min-w-0 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={allSelected}
              ref={(element) => {
                if (element) element.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={(event) => toggleAll(event.target.checked)}
            />
            <span>{t("orders.comments.pendingInvoices.selectAll")}</span>
          </label>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-foreground/75 underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40"
            disabled={!othersAvailable}
            onClick={selectOthers}
          >
            {t("common.table.selectAllOthers")}
          </button>
          <span className="ml-auto">{t("orders.comments.pendingInvoices.balance")}</span>
        </div>
        <ul className="max-h-80 divide-y divide-input/80 overflow-y-auto">
          {invoices.map((invoice) => {
            const checked = selectedIds.has(invoice.invoiceId);
            return (
              <li key={invoice.invoiceId}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50", checked && "bg-primary/10")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    onChange={() => toggle(invoice.invoiceId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {t("orders.comments.pendingInvoices.invoiceNumber", { number: invoice.invoiceNumber })}
                    </span>
                    {invoice.date ? (
                      <span className="block text-xs text-foreground/70">{formatInvoiceDate(invoice.date)}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
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
      <CompactActionDialogFooter className="items-center sm:justify-between">
        <p className="text-sm text-foreground/75">
          {selected.length > 0
            ? t("orders.comments.pendingInvoices.selectedSummary", {
                count: selected.length,
                total: formatInvoiceMoney(sumInvoiceBalances(selected)),
              })
            : null}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row max-md:contents">
          <Button type="button" variant="outline" className="border-input" onClick={onCancel}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            className="bg-[color-mix(in_oklab,var(--primary),black_18%)] text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary),black_26%)] disabled:bg-muted disabled:text-foreground/55 disabled:opacity-100"
            onClick={() => onSave(selected)}
          >
            {t("orders.comments.pendingInvoices.addToComment")}
          </Button>
        </div>
      </CompactActionDialogFooter>
    </>
  );
}
