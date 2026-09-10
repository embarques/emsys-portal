"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type InvoiceWizardNoticeProps = {
  tone: "error" | "warning";
  message: string;
  className?: string;
  action?: ReactNode;
  /** Banner sits above the step body; footer sits inline in the action bar. */
  variant?: "banner" | "footer";
};

export function InvoiceWizardNotice({
  tone,
  message,
  className,
  action,
  variant = "banner",
}: InvoiceWizardNoticeProps) {
  const Icon = tone === "error" ? AlertCircle : AlertTriangle;
  const isFooter = variant === "footer";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start text-sm",
        isFooter
          ? cn(
              "min-w-0 flex-1 gap-2 px-3 py-1.5",
              tone === "error"
                ? "rounded-md border border-destructive/30 bg-destructive/10 text-destructive"
                : "rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )
          : cn(
              "gap-2.5 px-5 py-3 sm:px-8",
              tone === "error"
                ? "border-b border-destructive/25 bg-destructive/10 text-destructive"
                : "border-b border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            ),
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className={cn("min-w-0 flex-1", action ? "space-y-2.5" : null)}>
        <p className="break-words leading-snug">{message}</p>
        {action ? <div className="print:hidden">{action}</div> : null}
      </div>
    </div>
  );
}
