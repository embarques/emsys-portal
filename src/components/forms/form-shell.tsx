"use client";

import { AlertCircle } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared form layout primitives that give every add/edit form the same look and
 * feel as the customer form: a tight, scrollable body with uppercase section
 * headers and a notice-aware footer.
 */

type FormSectionProps = {
  /** Optional leading icon rendered in the primary color. */
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  /** Append a required asterisk to the title. */
  required?: boolean;
  /** Optional control rendered on the right of the section header (e.g. an add button). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function FormSection({
  icon: Icon,
  title,
  required = false,
  action,
  className,
  children,
}: FormSectionProps) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
            {required ? <span className="text-destructive"> *</span> : null}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type FormBodyProps = {
  className?: string;
  children: React.ReactNode;
};

/** Scrollable form body with the shared muted background and padding. */
export function FormBody({ className, children }: FormBodyProps) {
  return (
    <div className={cn("flex-1 space-y-4 overflow-y-auto bg-muted/35 px-5 py-4", className)}>
      {children}
    </div>
  );
}

export type FormFooterNotice = {
  tone: "error" | "warning";
  message: string;
};

type FormFooterProps = {
  /** Error message (takes priority over the warning). */
  error?: string | null;
  /** Soft warning shown when there is no error (e.g. a block reason). */
  warning?: string | null;
  submitLabel: string;
  isSubmitting?: boolean;
  /** Disable submission without surfacing an error (e.g. validation gate). */
  submitDisabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

/** Footer with a left-aligned notice and right-aligned cancel/submit actions. */
export function FormFooter({
  error = null,
  warning = null,
  submitLabel,
  isSubmitting = false,
  submitDisabled = false,
  onCancel,
  cancelLabel,
}: FormFooterProps) {
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");

  const notice: FormFooterNotice | null = error
    ? { tone: "error", message: error }
    : warning
      ? { tone: "warning", message: warning }
      : null;

  return (
    <div className="shrink-0 border-t border-border bg-card px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        {notice ? (
          notice.tone === "error" ? (
            <div
              className={cn(
                "flex min-w-0 flex-1 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5",
                "text-sm text-destructive",
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{notice.message}</span>
            </div>
          ) : (
            <p className="min-w-0 flex-1 break-words text-sm text-amber-700 dark:text-amber-300">
              {notice.message}
            </p>
          )
        ) : (
          <span className="flex-1" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {resolvedCancelLabel}
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting || submitDisabled} title={notice?.message}>
            {isSubmitting ? t("common.actions.saving") : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
