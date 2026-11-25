"use client";

import { CircleMinus, CirclePlus, HandCoins, type LucideIcon } from "lucide-react";
import { TableSelectionActionItem } from "@/components/app-shell/table-selection-actions-menu";

import { Button } from "@/components/ui/button";

import { useTranslation } from "@/lib/i18n";
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
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
  /** Sheet footer buttons or Actions menu items. */
  variant?: "buttons" | "menu";
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
  variant = "buttons",
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

  const actionStyle = (action: LoanRecordAction) => {
    if (action === "payment") return "complete" as const;
    if (action === "increase") return "create" as const;
    return "caution" as const;
  };

  if (variant === "menu") {
    return (
      <>
        {actions.map(({ action, label }) => {
          const Icon = ACTION_ICONS[action];
          return (
            <TableSelectionActionItem
              key={action}
              disabled={disabled}
              onSelect={() => onAction(action)}
              className={tableSelectionActionMenuStyles[actionStyle(action)]}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </TableSelectionActionItem>
          );
        })}
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        fullWidth ? "w-full flex-col items-stretch" : "flex-wrap items-center",
        className,
      )}
    >
      {actions.map(({ action, label }) => {
        const Icon = ACTION_ICONS[action];
        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              fullWidth && "w-full",
              tableSelectionActionStyles[actionStyle(action)],
            )}
            disabled={disabled}
            onClick={() => onAction(action)}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Button>
        );
      })}
    </div>
  );
}