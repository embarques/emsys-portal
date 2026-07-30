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
    <section className={cn("py-6 first:pt-2", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground"
            aria-hidden
          >
            {number}
          </span>
          <h3 className="pt-0.5 text-base font-bold text-foreground sm:text-lg">{title}</h3>
        </div>
        {onEdit ? (
          <Button
            type="button"
            variant="link"
            className="h-auto shrink-0 px-0 text-primary"
            onClick={onEdit}
          >
            {resolvedEditLabel}
          </Button>
        ) : null}
      </div>
      <div className="pl-11">{children}</div>
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
