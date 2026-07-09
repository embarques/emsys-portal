"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type InvoiceViewCollapsibleSectionProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function InvoiceViewCollapsibleSection({
  title,
  description,
  icon: Icon,
  count,
  defaultOpen,
  children,
  footer,
  className,
}: InvoiceViewCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? count > 0);
  const sectionId = title.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-muted/20", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${sectionId}-panel`}
        className="flex w-full items-start gap-2 p-4 text-left transition-colors hover:bg-muted/30"
      >
        <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div id={`${sectionId}-panel`} className="border-t px-4 pb-4">
          {children}
        </div>
      ) : null}

      {footer ? <div className={cn("border-t px-4 py-4", open ? "pt-4" : "")}>{footer}</div> : null}
    </div>
  );
}
