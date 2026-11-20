"use client";

import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";

import { FormDialogChromeProvider } from "@/components/forms/form-dialog-chrome";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for compact action / create dialogs:
 * header (icon + title + description) → body → footer (actions).
 */

/** Desktop pad is owned by header/body/footer; this adds stacking + mobile bottom sheet. */
export const compactActionDialogContentClassName =
  "z-[70] gap-0 overflow-hidden p-0 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl";

/** Host for taller form dialogs — keep height, structured sections scroll in the body. */
export const compactActionDialogFormClassName =
  "flex max-h-[90vh] flex-col overflow-hidden";

export const compactActionDialogFooterClassName = "max-md:grid max-md:grid-cols-2";

type CompactActionDialogContentProps = React.ComponentProps<typeof DialogContent>;

export const CompactActionDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  CompactActionDialogContentProps
>(function CompactActionDialogContent({ className, children, onOpenAutoFocus, ...props }, ref) {
  return (
    <DialogContent
      ref={ref}
      className={cn(compactActionDialogContentClassName, className)}
      onOpenAutoFocus={(event) => {
        // Match assign-route dialogs: avoid stealing focus into the first control.
        event.preventDefault();
        onOpenAutoFocus?.(event);
      }}
      {...props}
    >
      <FormDialogChromeProvider>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </FormDialogChromeProvider>
    </DialogContent>
  );
});
CompactActionDialogContent.displayName = "CompactActionDialogContent";

type CompactActionDialogHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Leading Lucide icon in a soft chip (matches record-view sheet headers). */
  icon?: LucideIcon;
  className?: string;
};

/** Dialog header: icon chip + title + optional description, separated from the body. */
export function CompactActionDialogHeader({
  title,
  description,
  icon: Icon,
  className,
}: CompactActionDialogHeaderProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 border-b border-border bg-gradient-to-br from-muted/70 via-card to-card px-5 py-4 pr-12 max-md:px-4",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/40 to-transparent"
        aria-hidden
      />
      <DialogHeader className="relative space-y-0 text-left">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-primary shadow-sm"
              aria-hidden
            >
              <Icon className="size-4" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className="text-base font-semibold leading-tight tracking-tight sm:text-lg">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </div>
        </div>
      </DialogHeader>
    </div>
  );
}

type CompactActionDialogBodyProps = {
  children: React.ReactNode;
  className?: string;
};

/** Scrollable dialog body between header and footer. */
export function CompactActionDialogBody({ children, className }: CompactActionDialogBodyProps) {
  return (
    <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 max-md:px-4", className)}>
      {children}
    </div>
  );
}

type CompactActionDialogFooterProps = {
  className?: string;
  children?: React.ReactNode;
  /** Left-aligned error notice (catalog create/edit). */
  error?: string | null;
  /** Left-aligned warning when there is no error. */
  warning?: string | null;
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  /** Hide Cancel (e.g. change-password single primary). */
  hideCancel?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitType?: "button" | "submit";
  submitDisabled?: boolean;
  isSubmitting?: boolean;
  /** Leading icon on the primary button when not submitting. */
  submitIcon?: React.ReactNode;
};

/**
 * Footer with border separator: optional notice, Cancel outline, primary with icon.
 * Pass `children` to fully customize actions (still gets the mobile two-column grid).
 */
export function CompactActionDialogFooter({
  className,
  children,
  error = null,
  warning = null,
  onCancel,
  cancelLabel,
  cancelDisabled = false,
  hideCancel = false,
  onSubmit,
  submitLabel,
  submitType = "button",
  submitDisabled = false,
  isSubmitting = false,
  submitIcon,
}: CompactActionDialogFooterProps) {
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");
  const notice = error
    ? ({ tone: "error" as const, message: error })
    : warning
      ? ({ tone: "warning" as const, message: warning })
      : null;

  const shellClassName = cn(
    "sticky bottom-0 z-10 shrink-0 border-t border-border bg-card px-5 py-3 max-md:px-4",
    className,
  );

  if (children) {
    return (
      <div className={shellClassName}>
        <DialogFooter className={cn(compactActionDialogFooterClassName, "bg-transparent p-0")}>
          {children}
        </DialogFooter>
      </div>
    );
  }

  const actions = (
    <>
      {!hideCancel && onCancel ? (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={cancelDisabled || isSubmitting}
        >
          {resolvedCancelLabel}
        </Button>
      ) : null}
      {submitLabel ? (
        <Button
          type={submitType}
          onClick={submitType === "button" ? onSubmit : undefined}
          disabled={isSubmitting || submitDisabled}
          title={notice?.message}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            submitIcon
          )}
          {isSubmitting ? t("common.actions.saving") : submitLabel}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className={shellClassName}>
      {notice ? (
        <div className="mb-3">
          <FormFooterNoticeMessage tone={notice.tone} message={notice.message} />
        </div>
      ) : null}
      <DialogFooter className={cn(compactActionDialogFooterClassName, "bg-transparent p-0")}>
        {actions}
      </DialogFooter>
    </div>
  );
}
