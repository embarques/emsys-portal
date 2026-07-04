"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Minus, Pencil, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatInvoiceMoney, getPaymentLocationLabel } from "@/lib/invoices/display";
import {
  computeInvoiceBalance,
  resolveLineTotal,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

type Props = {
  values: InvoiceFormValues;
  className?: string;
  onDiscountChange?: (discount: string) => void;
};

const summaryPanelClassName =
  "rounded-xl border border-border/60 bg-muted/30 text-foreground shadow-sm";

const summaryDividerClassName = "border-t border-border/50";

function useInvoiceTotals(values: InvoiceFormValues) {
  return useMemo(() => {
    const lineRows = values.lineItems.filter(
      (item) => item.itemName.trim() || item.itemId || resolveLineTotal(item) > 0,
    );
    const subtotal = values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
    const discount = Number(values.discount) || 0;
    const amountPaid = Number(values.amountPaid) || 0;
    const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

    return { lineRows, subtotal, discount, amountPaid, balance };
  }, [values]);
}

function SummarySectionToggle({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 text-left text-sm font-semibold text-foreground"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {expanded ? <Minus className="size-3" /> : <Plus className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function SummaryLineRow({
  label,
  value,
  muted = false,
  indent = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 text-sm",
        indent && "pl-7",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <span className="min-w-0 flex-1">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

function SummaryDiscountControl({
  discountValue,
  discountAmount,
  onDiscountChange,
}: {
  discountValue: string;
  discountAmount: number;
  onDiscountChange?: (discount: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isApplied = discountAmount > 0;

  if (!onDiscountChange) {
    return isApplied ? (
      <SummaryLineRow label="Discount" value={`−${formatInvoiceMoney(discountAmount)}`} muted />
    ) : null;
  }

  function commitDiscount(raw: string) {
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount > 0) {
      onDiscountChange!(String(amount));
      setEditing(false);
      return;
    }

    onDiscountChange!("0");
    setEditing(false);
  }

  function removeDiscount() {
    onDiscountChange!("0");
    setEditing(false);
  }

  if (!isApplied && !editing) {
    return (
      <button
        type="button"
        className="text-left text-sm font-medium text-primary hover:underline"
        onClick={() => setEditing(true)}
      >
        + Add discount
      </button>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Discount amount</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={discountValue}
          autoFocus
          onChange={(event) => onDiscountChange!(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDiscount(discountValue);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              if (isApplied) {
                setEditing(false);
              } else {
                removeDiscount();
              }
            }
          }}
          onBlur={() => commitDiscount(discountValue)}
          placeholder="0.00"
          className="h-9 bg-card"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Remove discount"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white"
        onClick={removeDiscount}
      >
        <Minus className="size-3" />
      </button>
      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">Discount</span>
      <span className="shrink-0 text-sm font-medium text-foreground">
        −{formatInvoiceMoney(discountAmount)}
      </span>
      <button
        type="button"
        aria-label="Edit discount"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function InvoiceSummaryCard({
  values,
  onDiscountChange,
  defaultExpanded = true,
}: Props & { defaultExpanded?: boolean }) {
  const [summaryOpen, setSummaryOpen] = useState(defaultExpanded);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const { lineRows, subtotal, discount, amountPaid, balance } = useInvoiceTotals(values);
  const invoiceLabel = values.invoiceNumber.trim() || "New invoice";
  const showPaidAdjustment = amountPaid > 0;

  return (
    <div className="space-y-3">
      <div className={summaryPanelClassName}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setSummaryOpen((open) => !open)}
          aria-expanded={summaryOpen}
        >
          <span className="text-sm font-semibold text-foreground">Invoice summary</span>
          {summaryOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {summaryOpen ? (
          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">{invoiceLabel}</p>
              {values.sender ? (
                <p className="text-muted-foreground">{values.sender.name}</p>
              ) : (
                <p className="text-muted-foreground">Sender not selected</p>
              )}
              <p className="text-xs text-muted-foreground">
                Pending · {getPaymentLocationLabel(values.paymentLocation)}
              </p>
            </div>

            <div className={cn("space-y-3 pt-1", summaryDividerClassName)}>
              <SummarySectionToggle
                expanded={detailsOpen}
                label="Order details"
                onToggle={() => setDetailsOpen((open) => !open)}
              />
              {detailsOpen ? (
                <div className="space-y-2">
                  {lineRows.length === 0 ? (
                    <SummaryLineRow label="Line items" value="—" muted indent />
                  ) : (
                    lineRows.map((item) => (
                      <SummaryLineRow
                        key={item.id}
                        label={item.itemName.trim() || "Line item"}
                        value={formatInvoiceMoney(resolveLineTotal(item))}
                        muted
                        indent
                      />
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {showPaidAdjustment ? (
              <div className={cn("pt-1", summaryDividerClassName)}>
                <SummaryLineRow label="Paid" value={`−${formatInvoiceMoney(amountPaid)}`} muted />
              </div>
            ) : null}

            <div className={cn("space-y-3 pt-1", summaryDividerClassName)}>
              <SummaryLineRow label="Subtotal" value={formatInvoiceMoney(subtotal)} />
              <SummaryDiscountControl
                discountValue={values.discount}
                discountAmount={discount}
                onDiscountChange={onDiscountChange}
              />
            </div>

            <div className={cn("flex items-end justify-between gap-3 pt-1", summaryDividerClassName)}>
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-xl font-bold leading-none text-foreground">
                {formatInvoiceMoney(balance)}
              </span>
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center justify-between px-4 pb-4 pt-1", summaryDividerClassName)}>
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">{formatInvoiceMoney(balance)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Desktop sidebar — visible from lg breakpoint up. */
export function InvoiceWizardSummarySidebar({
  values,
  className,
  onDiscountChange,
}: Props) {
  return (
    <aside
      data-print-hide
      className={cn(
        "hidden w-[min(100%,20rem)] shrink-0 flex-col overflow-y-auto bg-background p-4 lg:flex",
        className,
      )}
    >
      <InvoiceSummaryCard values={values} onDiscountChange={onDiscountChange} />
    </aside>
  );
}

/** Mobile / tablet sticky summary — shown below lg. */
export function InvoiceWizardSummaryMobileBar({
  values,
  className,
  onDiscountChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { balance } = useInvoiceTotals(values);

  return (
    <div
      data-print-hide
      className={cn("shrink-0 border-t border-border bg-background px-4 py-3 lg:hidden", className)}
    >
      {expanded ? (
        <div className="max-h-[min(60vh,24rem)] space-y-3 overflow-y-auto">
          <InvoiceSummaryCard
            values={values}
            onDiscountChange={onDiscountChange}
            defaultExpanded
          />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setExpanded(false)}
          >
            Hide details
            <ChevronDown className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={cn("flex w-full items-center justify-between gap-3 px-3 py-3 text-left", summaryPanelClassName)}
          onClick={() => setExpanded(true)}
        >
          <span className="text-sm font-semibold text-foreground">Invoice summary</span>
          <span className="flex items-center gap-2">
            <span className="text-base font-bold text-foreground">{formatInvoiceMoney(balance)}</span>
            <ChevronUp className="size-4 text-muted-foreground" />
          </span>
        </button>
      )}
    </div>
  );
}
