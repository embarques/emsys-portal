"use client";

import { CircleMinus, CirclePlus, HandCoins, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type LoanRecordAction = "payment" | "increase" | "decrease";

type Props = {
  disabled?: boolean;
  canPay?: boolean;
  canIncrease?: boolean;
  canDecrease?: boolean;
  /**
   * Show "Increase loan principal" even when the API / feature flag is not ready.
   * Click still calls `onAction("increase")` so the parent can toast a TODO.
   */
  showIncreaseTodo?: boolean;
  className?: string;
  /** Stretch buttons to full width (footer). */
  fullWidth?: boolean;
  onAction: (action: LoanRecordAction) => void;
};

const ACTION_ICONS: Record<LoanRecordAction, LucideIcon> = {
  payment: HandCoins,
  increase: CirclePlus,
  decrease: CircleMinus,
};

/**
 * Per-loan mutating shortcuts for the loan view sheet footer.
 * Only permitted actions render — no disabled placeholders (except increase TODO).
 */
export function LoanRecordActions({
  disabled = false,
  canPay = false,
  canIncrease = false,
  canDecrease = false,
  showIncreaseTodo = false,
  className,
  fullWidth = false,
  onAction,
}: Props) {
  const { t } = useTranslation();
  const actions = (
    [
      canPay
        ? {
            action: "payment" as const,
            label: t("accounting.loans.recordActions.payment"),
          }
        : null,
      canIncrease || showIncreaseTodo
        ? {
            action: "increase" as const,
            label: t("accounting.loans.recordActions.increase"),
          }
        : null,
      canDecrease
        ? {
            action: "decrease" as const,
            label: t("accounting.loans.recordActions.decrease"),
          }
        : null,
    ] as const
  ).filter(Boolean) as Array<{ action: LoanRecordAction; label: string }>;

  if (actions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", fullWidth && "w-full", className)}>
      {actions.map(({ action, label }) => {
        const Icon = ACTION_ICONS[action];
        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === "payment" ? "default" : "outline"}
            className={cn(fullWidth && "min-w-0 flex-1")}
            disabled={disabled}
            onClick={() => onAction(action)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
