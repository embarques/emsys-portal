"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type InvoiceWizardNoticeProps = {
  tone: "error" | "warning";
  message: string;
  className?: string;
};

export function InvoiceWizardNotice({ tone, message, className }: InvoiceWizardNoticeProps) {
  const Icon = tone === "error" ? AlertCircle : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 px-5 py-3 text-sm sm:px-8",
        tone === "error"
          ? "border-b border-destructive/25 bg-destructive/10 text-destructive"
          : "border-b border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 break-words leading-snug">{message}</p>
    </div>
  );
}
