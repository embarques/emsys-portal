"use client";

import { Loader2, Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type ConfirmDeleteButtonProps = {
  isPending?: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Override the idle label (defaults to common.actions.delete). */
  label?: string;
  /** Override the pending label (defaults to common.actions.deleting). */
  pendingLabel?: string;
  /** Idle icon (defaults to Trash2). Hidden while pending in favor of a spinner. */
  icon?: LucideIcon;
  className?: string;
};

/** Destructive confirm action that shows a spinner + pending label while waiting. */
export function ConfirmDeleteButton({
  isPending = false,
  disabled = false,
  onClick,
  label,
  pendingLabel,
  icon: Icon = Trash2,
  className,
}: ConfirmDeleteButtonProps) {
  const { t } = useTranslation();
  const idleLabel = label ?? t("common.actions.delete");
  const busyLabel = pendingLabel ?? t("common.actions.deleting");

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={onClick}
      disabled={disabled || isPending}
      className={className}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {isPending ? busyLabel : idleLabel}
    </Button>
  );
}
