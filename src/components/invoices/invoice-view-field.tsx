"use client";

import type { ReactNode } from "react";

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
    <div className={cn("flex flex-col gap-0.5", className)}>
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
};

export function InvoiceViewListItem({ children, className }: InvoiceViewListItemProps) {
  return (
    <li className={cn("space-y-2.5 rounded-lg border bg-background px-3 py-3", className)}>{children}</li>
  );
}
