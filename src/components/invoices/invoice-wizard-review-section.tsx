"use client";

import { Pencil } from "lucide-react";

import { FormSection } from "@/components/forms/form-shell";
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

  if (variant === "phonePanel") {
    return (
      <section className={cn("rounded-xl bg-muted/45 p-4", className)}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-3">
          <h3 className="min-w-0 text-xl font-bold leading-tight text-foreground">{title}</h3>
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-primary"
              onClick={onEdit}
              aria-label={resolvedEditLabel}
            >
              <Pencil className="size-5" />
            </Button>
          ) : null}
        </div>
        <div>{children}</div>
      </section>
    );
  }

  return (
    <FormSection
      variant="card"
      title={`${String(number).padStart(2, "0")} · ${title}`}
      className={className}
      action={onEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          {resolvedEditLabel}
        </Button>
      ) : undefined}
    >
      {children}
    </FormSection>
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
