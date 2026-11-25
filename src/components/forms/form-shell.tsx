"use client";

import { useId } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";

import { useFormDialogChrome } from "@/components/forms/form-dialog-chrome";
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
  /** Omit when a surrounding heading already names the section. */
  title?: string;
  variant?: "plain" | "card";
  description?: string;
  /** Append a required asterisk to the title. */
  required?: boolean;
  /** Optional control rendered on the right of the section header (e.g. an add button). */
  action?: React.ReactNode;
  /**
   * Fill remaining height in a flex/grid parent and clip overflow so nested
   * scroll regions (lists + sticky add buttons) stay inside the card.
   */
  fill?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function FormSection({
  icon: Icon,
  title,
  variant = "plain",
  description,
  required = false,
  action,
  fill = false,
  className,
  children,
}: FormSectionProps) {
  const sectionId = useId();
  return (
    <section
      id={sectionId}
      data-form-section
      tabIndex={-1}
      className={cn(
        "space-y-2.5",
        variant === "card" && "min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm",
        fill && "flex min-h-0 flex-col overflow-hidden",
        className,
      )}
    >
      {title || action ? (
        <div className={cn("flex min-h-7 items-center justify-between gap-2", fill && "shrink-0")}>
          <div className="flex shrink-0 items-center gap-2">
            {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
            {title ? (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
                {required ? <span className="text-destructive"> *</span> : null}
              </h3>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {description ? (
        <p className={cn("text-sm leading-relaxed text-muted-foreground", fill && "shrink-0")}>
          {description}
        </p>
      ) : null}
      {fill ? <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div> : children}
    </section>
  );
}

type FormBodyProps = {
  className?: string;
  workflow?: boolean;
  /** When true, shows a saving overlay so the wait is obvious during CRUD. */
  isBusy?: boolean;
  /** Optional busy message (defaults to common.actions.saving). */
  busyLabel?: string;
  children: React.ReactNode;
};

/** Scrollable form body with the shared muted background and padding. */
export function FormBody({ className, workflow = false, isBusy = false, busyLabel, children }: FormBodyProps) {
  const { t } = useTranslation();
  const inDialog = useFormDialogChrome();

  return (
    <div
      data-form-body
      className={cn(
        "relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain",
        inDialog
          ? "bg-transparent px-5 py-4 max-md:px-4"
          : "bg-muted/35 px-5 py-4",
        workflow && !inDialog && "@container space-y-5 p-4 sm:p-6",
        workflow && inDialog && "@container space-y-4",
        className,
      )}
    >
      {children}
      {isBusy ? (
        <div
          className="absolute inset-0 z-10 m-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            {busyLabel ?? t("common.actions.saving")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type FormFooterNotice = {
  tone: "error" | "warning";
  message: string;
};

type FormFooterNoticeMessageProps = FormFooterNotice & {
  action?: React.ReactNode;
  className?: string;
};

/**
 * Footer notice shared by every add/edit form: errors render in a destructive
 * box, warnings (invalid or missing required inputs) render as amber text with
 * an info icon.
 */
export function FormFooterNoticeMessage({ tone, message, action, className }: FormFooterNoticeMessageProps) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : Info;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex min-w-0 flex-1 items-start gap-2 text-sm",
        isError
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive"
          : "text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className={cn("min-w-0 flex-1", action ? "space-y-2.5" : null)}>
        <p className="break-words">{message}</p>
        {action ? <div className="print:hidden">{action}</div> : null}
      </div>
    </div>
  );
}

type FormFooterProps = {
  /** Error message (takes priority over the warning). */
  error?: string | null;
  /** Soft warning shown when there is no error (e.g. a block reason). */
  warning?: string | null;
  /** Optional control under an error notice (e.g. open another workspace). */
  errorAction?: React.ReactNode;
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
  errorAction,
  submitLabel,
  isSubmitting = false,
  submitDisabled = false,
  onCancel,
  cancelLabel,
}: FormFooterProps) {
  const { t } = useTranslation();
  const inDialog = useFormDialogChrome();
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");

  const notice: FormFooterNotice | null = error
    ? { tone: "error", message: error }
    : warning
      ? { tone: "warning", message: warning }
      : null;

  const actions = (
    <>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {resolvedCancelLabel}
        </Button>
      ) : null}
      <Button type="submit" disabled={isSubmitting || submitDisabled} title={notice?.message}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {isSubmitting ? t("common.actions.saving") : submitLabel}
      </Button>
    </>
  );

  if (inDialog) {
    return (
      <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-border bg-card px-5 py-3 max-md:px-4">
        {notice ? (
          <FormFooterNoticeMessage
            tone={notice.tone}
            message={notice.message}
            action={notice.tone === "error" ? errorAction : undefined}
          />
        ) : null}
        <div className="flex flex-col-reverse gap-2 max-md:grid max-md:grid-cols-2 sm:flex-row sm:justify-end">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-card px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        {notice ? (
          <FormFooterNoticeMessage
            tone={notice.tone}
            message={notice.message}
            action={notice.tone === "error" ? errorAction : undefined}
          />
        ) : (
          <span className="flex-1" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
