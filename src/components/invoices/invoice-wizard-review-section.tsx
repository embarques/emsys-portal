"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceWizardReviewSectionProps = {
  number: number;
  title: string;
  onEdit?: () => void;
  editLabel?: string;
  variant?: "default" | "phonePanel";
  className?: string;
  children: React.ReactNode;
};

export function InvoiceWizardReviewSection({
  number,
  title,
  onEdit,
  editLabel,
  variant = "default",
  className,
  children,
}: InvoiceWizardReviewSectionProps) {
  const { t } = useTranslation();
  const resolvedEditLabel = editLabel ?? t("invoices.wizard.review.editStep");

  return (
    <section className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm print:break-inside-avoid print:shadow-none", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
        <h3 className="flex min-w-0 items-center gap-3 text-sm font-semibold text-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs tabular-nums text-primary">
            {String(number).padStart(2, "0")}
          </span>
          {title}
        </h3>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size={variant === "phonePanel" ? "icon" : "sm"}
            className="shrink-0 text-muted-foreground hover:text-foreground print:hidden"
            onClick={onEdit}
            aria-label={`${resolvedEditLabel}: ${title}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {variant === "phonePanel" ? null : resolvedEditLabel}
          </Button>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

type ReviewTextBlockProps = {
  label?: string;
  value: React.ReactNode;
  className?: string;
};

export function InvoiceWizardReviewTextBlock({ label, value, className }: ReviewTextBlockProps) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {label ? <p className="font-semibold text-foreground">{label}</p> : null}
      <div className="text-muted-foreground">{value}</div>
    </div>
  );
}

/** Yellow highlight for empty optional fields on Review & save. */
export const invoiceReviewOptionalMissingClassName =
  "rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";

export function InvoiceWizardReviewOptionalMissing({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(invoiceReviewOptionalMissingClassName, className)}>{children}</span>;
}
