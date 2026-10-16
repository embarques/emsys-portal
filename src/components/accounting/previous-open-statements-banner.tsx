"use client";

import { AlertCircle, Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: ReactNode;
  closeLabel: string;
  closingLabel: string;
  isClosing: boolean;
  onClose: () => void;
  closeButtonTestId?: string;
  className?: string;
};

export function PreviousOpenStatementsBanner({
  title,
  description,
  closeLabel,
  closingLabel,
  isClosing,
  onClose,
  closeButtonTestId,
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/35",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{title}</p>
            <div className="text-sm leading-snug text-muted-foreground">{description}</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={onClose}
            disabled={isClosing}
            data-testid={closeButtonTestId}
          >
            {isClosing ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {isClosing ? closingLabel : closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
