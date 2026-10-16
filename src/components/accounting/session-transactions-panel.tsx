"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PanelRightOpen, ReceiptText, X } from "lucide-react";
import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { sessionTransactionDetails, sessionTransactionTotals, sessionTransactionsNetTotal, type SessionTransaction } from "@/lib/accounting/daily-income/session-transactions";
import { useTranslation } from "@/lib/i18n";

export function SessionTransactionsPanel({ entries, currency, onClose }: { entries: SessionTransaction[]; currency: string; onClose?: () => void }) {
  const { t } = useTranslation();
  const prefix = "accounting.dailyIncome.sessionPanel";
  const field = (name: string) => t(`accounting.dailyIncome.form.fields.${name}`);
  const money = (value: number) => formatDailyIncomeMoney(value, currency);
  const totals = sessionTransactionTotals(entries);
  function methodLabel(method: string, amount: number) {
    if (amount === 0) return t(`${prefix}.noPayment`);
    if (method === "DEPOSIT") return t(`${prefix}.deposit`);
    const keys: Record<string, string> = { CASH: "cash", CHECK: "check", CHEQUE: "check", "CREDIT-CARD": "credit_card", ZELLE: "zelle" };
    return keys[method] ? t(`invoices.view.payments.methods.${keys[method]}`) : method || "—";
  }
  function amounts(cost: number, amount: number, balance: number, invoice: boolean) {
    return <dl className={`grid gap-2 ${invoice ? "grid-cols-3" : "grid-cols-1"}`}>
      {invoice && <div><dt className="text-xs text-muted-foreground">{field("cost")}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{money(cost)}</dd></div>}
      <div><dt className="text-xs text-muted-foreground">{t(`${prefix}.${invoice ? "payment" : "amount"}`)}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{money(amount)}</dd></div>
      {invoice && <div><dt className="text-xs text-muted-foreground">{field("balance")}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{money(balance)}</dd></div>}
    </dl>;
  }
  return <aside aria-label={t(`${prefix}.title`)} className="absolute inset-0 hidden h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:flex">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3"><div><h2 className="text-base font-semibold">{t(`${prefix}.title`)}</h2><p className="mt-0.5 text-xs text-muted-foreground">{t(`${prefix}.subtitle`, { count: entries.length })}</p></div>{onClose && <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t(`${prefix}.hide`)} onClick={onClose}><X className="size-4" aria-hidden="true" /></Button>}</header>
    <div role="region" aria-label={t(`${prefix}.list`)} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {entries.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted-foreground"><ReceiptText className="mx-auto mb-3 size-6" aria-hidden="true" />{t(`${prefix}.empty`)}</div> : entries.map((entry) => {
        const d = sessionTransactionDetails(entry);
        const invoice = d.type === "INITIAL-PAYMENT";
        const invoiceRelated = invoice || ["PAYMENT", "DISCOUNT", "SURCHARGE"].includes(d.type);
        return <article key={entry.journal.id || entry.savedAt} className="space-y-3 border-b p-4 last:border-b-0">
          <div><p className="text-xs text-muted-foreground">{transactionTypeLabel(d.type, t)}</p><h3 className="mt-1 break-words text-sm font-semibold">{invoiceRelated ? `#${d.invoice}` : d.type === "INVENTORY" ? d.item : d.account || d.reference || "—"}</h3></div>
          {amounts(d.cost, d.amount, d.balance, invoice)}
          {d.type === "INVENTORY" ? <p className="break-words text-xs text-muted-foreground">{d.direction ? t(`accounting.dailyIncome.form.inventory.${d.direction}`) : ""} · {t("inventory.form.fields.quantity")}: {d.quantity ?? "—"}{d.supplier ? ` · ${d.supplier}` : ""}</p> : !["DISCOUNT", "SURCHARGE"].includes(d.type) && <p className="break-words text-xs text-muted-foreground">{field("paymentMethod")}: {methodLabel(d.method, d.amount)}</p>}
          {d.type === "TRANSFER" && d.sourceAccount && <p className="break-words text-xs text-muted-foreground">{field("sourceAccount")}: {d.sourceAccount}</p>}
          {!invoiceRelated && d.description && <p className="break-words text-xs text-muted-foreground">{d.description}</p>}
        </article>;
      })}
    </div>
    <footer aria-live="polite" className="shrink-0 space-y-3 border-t bg-card p-4"><div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">{t(`${prefix}.total`)}</h3><span className="text-lg font-semibold tabular-nums">{money(sessionTransactionsNetTotal(entries))}</span></div>{totals.length ? totals.map((total) => <div key={total.type} className="space-y-2">{total.type === "INITIAL-PAYMENT" ? <><p className="text-xs text-muted-foreground">{transactionTypeLabel(total.type, t)} · {total.count}</p>{amounts(total.cost, total.amount, total.balance, true)}</> : <div className="flex items-baseline justify-between gap-2 text-xs"><span className="text-muted-foreground">{transactionTypeLabel(total.type, t)} · {total.count}</span><span className="font-medium tabular-nums">{money(total.amount)}</span></div>}</div>) : <p className="text-sm tabular-nums">{money(0)}</p>}</footer>
  </aside>;
}

export function SessionTransactionsLayout({ children, entries, currency, active = true }: { children: ReactNode; entries: SessionTransaction[]; currency: string; active?: boolean }) {
  const { t } = useTranslation();
  const [panelVisible, setPanelVisible] = useState(true);
  const showPanel = active && panelVisible;
  const panelId = useId();
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      {active && !panelVisible ? (
        <div className="mb-3 hidden justify-end xl:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={panelVisible}
            aria-controls={panelId}
            onClick={() => setPanelVisible(true)}
          >
            <PanelRightOpen className="size-4" aria-hidden="true" />
            {t("accounting.dailyIncome.sessionPanel.show")}
          </Button>
        </div>
      ) : null}
      <div
        className={`grid w-full items-stretch gap-5 ${showPanel ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}
      >
        <div className="min-h-0 min-w-0">{children}</div>
        <div
          id={panelId}
          hidden={!showPanel}
          className={showPanel ? "relative hidden min-h-0 min-w-0 xl:block" : "hidden"}
        >
          <SessionTransactionsPanel
            entries={entries}
            currency={currency}
            onClose={() => setPanelVisible(false)}
          />
        </div>
      </div>
    </div>
  );
}
