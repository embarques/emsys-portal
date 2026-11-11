"use client";

import { useId, useRef, useState } from "react";

import { INLINE_FIELD_ROW_CLASS_NAME } from "@/components/forms/inline-field-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAccountingMoney } from "@/lib/accounting/display";
import {
  INVOICE_ADJUSTMENT_PRESET_PERCENTS,
  exceedsMoneyAmount,
  getPercentAmount,
  isSameMoneyAmount,
  parseAdjustmentPercent,
  type InvoiceAdjustmentKind,
} from "@/lib/accounting/daily-income/invoice-adjustment-presets";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  kind: InvoiceAdjustmentKind;
  /** Show the label beside the buttons instead of above them. */
  inline?: boolean;
  /** Invoice total that percents are taken from; undefined until an invoice is selected. */
  total: number | undefined;
  /** Presets above this amount are disabled (a discount cannot exceed the balance). */
  maxAmount?: number;
  amount: number | undefined;
  onSelectAmount: (amount: number) => void;
  onCustomAmount: () => void;
  disabled?: boolean;
};

export function InvoiceAdjustmentPresetButtons({
  kind,
  inline = false,
  total,
  maxAmount,
  amount,
  onSelectAmount,
  onCustomAmount,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const labelId = useId();
  const customPercentId = useId();
  const customPercentRef = useRef<HTMLInputElement>(null);
  const [customPercentOpen, setCustomPercentOpen] = useState(false);
  const [customPercent, setCustomPercent] = useState("");

  const hasTotal = (total ?? 0) > 0;
  const amountFor = (percent: number) => getPercentAmount(total ?? 0, percent);

  const presets = INVOICE_ADJUSTMENT_PRESET_PERCENTS[kind].map((percent) => ({ percent, amount: amountFor(percent) }));
  const parsedCustomPercent = parseAdjustmentPercent(customPercent);
  const customPercentAmount = parsedCustomPercent != null ? amountFor(parsedCustomPercent) : 0;
  const customPercentActive = customPercentOpen && customPercentAmount > 0 && isSameMoneyAmount(customPercentAmount, amount);
  const activePercent = customPercentOpen
    ? undefined
    : presets.find((preset) => preset.amount > 0 && isSameMoneyAmount(preset.amount, amount))?.percent;
  const customAmountActive = !customPercentActive && activePercent == null && amount != null && amount > 0;

  function applyPercent(percent: number | undefined) {
    if (percent == null) return;
    const next = amountFor(percent);
    if (next > 0) onSelectAmount(next);
  }

  function openCustomPercent() {
    setCustomPercentOpen(true);
    requestAnimationFrame(() => {
      customPercentRef.current?.focus();
      customPercentRef.current?.select();
    });
    applyPercent(parsedCustomPercent);
  }

  return (
    <div className={inline ? INLINE_FIELD_ROW_CLASS_NAME : "space-y-2"}>
      <p id={labelId} className={inline ? "text-sm font-medium leading-none" : "text-xs font-medium text-muted-foreground"}>
        {t(`accounting.dailyIncome.form.adjustmentPresets.label.${kind}`)}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = activePercent === preset.percent;
          const overLimit = exceedsMoneyAmount(preset.amount, maxAmount);
          return (
            <Button
              key={preset.percent}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="min-w-14 tabular-nums"
              aria-pressed={active}
              title={
                overLimit
                  ? t("accounting.dailyIncome.form.adjustmentPresets.exceedsBalance")
                  : preset.amount > 0
                    ? formatAccountingMoney(preset.amount)
                    : undefined
              }
              disabled={disabled || preset.amount <= 0 || overLimit}
              onClick={() => {
                setCustomPercentOpen(false);
                onSelectAmount(preset.amount);
              }}
            >
              {t("accounting.dailyIncome.form.adjustmentPresets.percent", { percent: preset.percent })}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant={customPercentActive ? "default" : "outline"}
          aria-pressed={customPercentActive}
          aria-expanded={customPercentOpen}
          aria-controls={customPercentId}
          disabled={disabled || !hasTotal}
          onClick={openCustomPercent}
        >
          {t("accounting.dailyIncome.form.adjustmentPresets.customPercent")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={customAmountActive ? "default" : "outline"}
          aria-pressed={customAmountActive}
          disabled={disabled}
          onClick={() => {
            setCustomPercentOpen(false);
            onCustomAmount();
          }}
        >
          {t("accounting.dailyIncome.form.adjustmentPresets.customAmount")}
        </Button>
      </div>
      {customPercentOpen ? (
        <div className={cn("flex flex-wrap items-center gap-2", inline && "sm:col-start-2")}>
          <label htmlFor={customPercentId} className="text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.adjustmentPresets.customPercentLabel")}
          </label>
          <div className="relative w-28">
            <Input
              ref={customPercentRef}
              id={customPercentId}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              className="pr-7 tabular-nums"
              placeholder={t("accounting.dailyIncome.form.adjustmentPresets.customPercentPlaceholder")}
              value={customPercent}
              disabled={disabled}
              onChange={(event) => {
                setCustomPercent(event.target.value);
                applyPercent(parseAdjustmentPercent(event.target.value));
              }}
            />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          {parsedCustomPercent != null && hasTotal ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("accounting.dailyIncome.form.adjustmentPresets.percentOfTotal", {
                percent: parsedCustomPercent,
                amount: formatAccountingMoney(customPercentAmount),
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
