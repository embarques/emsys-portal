"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for compact action / create dialogs (Assign route style):
 * padded desktop content, mobile bottom sheet, Cancel outline + primary footer.
 */

/** Desktop pad inherits DialogContent; this adds stacking + mobile bottom sheet. */
export const compactActionDialogContentClassName =
  "z-[70] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4";

export const compactActionDialogFooterClassName = "max-md:grid max-md:grid-cols-2";

type CompactActionDialogContentProps = React.ComponentProps<typeof DialogContent>;

export const CompactActionDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  CompactActionDialogContentProps
>(function CompactActionDialogContent({ className, onOpenAutoFocus, ...props }, ref) {
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
    />
  );
});
CompactActionDialogContent.displayName = "CompactActionDialogContent";

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
 * Footer matching Assign route: optional notice, Cancel outline, primary with icon.
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

  if (children) {
    return (
      <DialogFooter className={cn(compactActionDialogFooterClassName, className)}>
        {children}
      </DialogFooter>
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

  if (notice) {
    return (
      <div className={cn("sticky bottom-0 z-10 flex shrink-0 flex-col gap-3", className)}>
        <FormFooterNoticeMessage tone={notice.tone} message={notice.message} />
        <DialogFooter className={compactActionDialogFooterClassName}>{actions}</DialogFooter>
      </div>
    );
  }

  return (
    <DialogFooter className={cn(compactActionDialogFooterClassName, className)}>
      {actions}
    </DialogFooter>
  );
}
