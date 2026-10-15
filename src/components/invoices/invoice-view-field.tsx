"use client";

import type { ReactNode } from "react";

import { RecordViewListItem } from "@/components/app-shell/record-view-list";

import { cn } from "@/lib/utils";

type InvoiceViewFieldProps = {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
};

function isEmptyValue(value: ReactNode): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "—" || trimmed === "-";
  }
  return false;
}

export function InvoiceViewField({ label, value, mono, className }: InvoiceViewFieldProps) {
  if (isEmptyValue(value)) return null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm leading-snug text-foreground", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

type InvoiceViewListItemProps = {
  children: ReactNode;
  className?: string;
  layout?: "stack" | "grid";
};

export function InvoiceViewListItem({ children, className, layout = "stack" }: InvoiceViewListItemProps) {
  return (
    <RecordViewListItem
      className={cn(
        "p-3",
        layout === "grid"
          ? "grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-x-4 gap-y-2.5"
          : "space-y-2.5",
        className,
      )}
    >
      {children}
    </RecordViewListItem>
  );
}
