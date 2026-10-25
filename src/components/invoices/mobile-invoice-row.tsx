"use client";
import { useState } from "react";
import { FileText, Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getInvoicePrimaryReceiver, type Invoice } from "@/lib/invoices/types";
import { getInvoiceBalance, getInvoicePartyDisplayPhone, formatInvoicePartyAddressLine, formatInvoiceDate, formatInvoiceMoney, formatInvoiceItemCount, getContainerLabelForInvoice } from "@/lib/invoices/display";

function getInvoiceMobileInitials(invoice: Invoice): string {
  const name =
    invoice.sender?.name?.trim() ||
    getInvoicePrimaryReceiver(invoice)?.name?.trim() ||
    invoice.invoiceNumber;
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "IN";
}

function getInvoiceMobilePartyName(invoice: Invoice, emptyLabel: string): string {
  return invoice.sender?.name?.trim() || getInvoicePrimaryReceiver(invoice)?.name?.trim() || emptyLabel;
}

function getInvoiceMobilePhone(invoice: Invoice, emptyLabel: string): string {
  const senderPhone = getInvoicePartyDisplayPhone(invoice.sender);
  if (senderPhone !== "—") return senderPhone;

  const phone = invoice.sender.phones.find((entry) => entry.number?.trim());
  return phone?.number?.trim() || emptyLabel;
}

function getInvoiceMobileAddress(invoice: Invoice, emptyLabel: string): string {
  const addressLine = formatInvoicePartyAddressLine(invoice.sender);
  return addressLine === "—" ? emptyLabel : addressLine;
}

export function MobileInvoiceRow({ invoice, onOpen, selected, selectionMode, onToggleSelected, onPrint }: {
  invoice: Invoice; onOpen: (invoice: Invoice) => void; selected: boolean; selectionMode: boolean;
  onToggleSelected: (invoiceId: string, checked: boolean) => void;
  onPrint?: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const balance = getInvoiceBalance(invoice);
  const itemCount = invoice.itemCount ?? invoice.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const incomplete = String(invoice.apiTableValues?.registration ?? "").toUpperCase() === "PENDING";
  const receiver = getInvoicePrimaryReceiver(invoice);
  return <article className={cn("border-b border-border/70 bg-card px-4 py-[17px] last:border-0 [content-visibility:auto] [contain-intrinsic-size:auto_150px]", selected && "bg-primary/5")}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {selectionMode ? <input type="checkbox" className="size-5 accent-primary" aria-label={t("invoices.mobile.selectInvoice", { invoice: invoice.invoiceNumber })} checked={selected} onChange={event => onToggleSelected(invoice.invoiceId, event.target.checked)} /> : null}
        <button type="button" className="min-h-11 truncate text-left text-[13px] font-semibold tracking-wide text-primary" aria-expanded={expanded} onClick={() => selectionMode ? onToggleSelected(invoice.invoiceId, !selected) : setExpanded(value => !value)}>{invoice.invoiceNumber}</button>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{formatInvoiceDate(invoice.date)}</span>
    </div>
    <div className="flex items-center gap-2.5">
      <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">{getInvoiceMobileInitials(invoice)}</div>
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{getInvoiceMobilePartyName(invoice, "—")}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{getInvoiceMobileAddress(invoice, "—")}</div></div>
      <div className="shrink-0 text-right tabular-nums"><strong className="block text-lg font-semibold tracking-tight">{formatInvoiceMoney(balance)}</strong><span className="text-[10px] text-muted-foreground">{t("invoices.mobile.balance")}</span></div>
    </div>
    <div className="ml-[46px] mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Package className="size-3.5" aria-hidden="true" />{getContainerLabelForInvoice(invoice)}<span>· {t(itemCount === 1 ? "invoices.mobile.item" : "invoices.mobile.items", { count: formatInvoiceItemCount(itemCount) })}</span></span>
      <span className={cn("rounded-md px-2 py-1 text-[10px]", incomplete || balance > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>{t(incomplete ? "invoices.mobile.incomplete" : balance > 0 ? "invoices.mobile.due" : "invoices.mobile.paid")}</span>
    </div>
    {expanded ? <div className="ml-[46px] mt-3 border-t pt-3 text-xs text-muted-foreground"><p className="text-foreground">{t("invoices.mobile.to")} {receiver?.name || "—"}</p><p className="mt-1">{formatInvoicePartyAddressLine(receiver)}</p><p className="mt-2">{getInvoiceMobilePhone(invoice, "—")}</p><div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-10 rounded-lg bg-primary/10 text-primary" variant="ghost" size="sm" onClick={() => onOpen(invoice)}><FileText className="size-4" />{t("invoices.mobile.viewInvoice")}</Button>{onPrint ? <Button variant="ghost" size="sm" className="min-h-10 rounded-lg bg-primary/10 text-primary" onClick={() => onPrint(invoice)}><Printer className="size-4" />{t("invoices.mobile.print")}</Button> : null}</div></div> : null}
  </article>;
}

