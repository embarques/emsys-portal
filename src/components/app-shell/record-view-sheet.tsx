"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type RecordViewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

type RecordViewSheetContentProps = {
  children: React.ReactNode;
  className?: string;
};

type RecordViewSheetHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
};

type RecordViewSheetBodyProps = {
  children: React.ReactNode;
  className?: string;
};

type RecordViewSheetSectionProps = {
  title?: string;
  /** Optional leading icon, matching the add/edit form section style. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional control aligned to the right of the section header (e.g. flip / expand). */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: "default" | "relaxed";
};

type RecordViewSheetDetailRowProps = {
  label: string;
  value: React.ReactNode;
};

function isPlaceholderValue(value: React.ReactNode): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "—" || trimmed === "-";
  }

  return false;
}

type RecordViewSheetActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  isDisabled?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
};

export function RecordViewSheet({ open, onOpenChange, children }: RecordViewSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
    </Sheet>
  );
}

export function RecordViewSheetContent({ children, className }: RecordViewSheetContentProps) {
  return (
    <SheetContent
      side="right"
      className={cn(
        "flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
        className,
      )}
    >
      {children}
    </SheetContent>
  );
}

export function RecordViewSheetHeader({ title, description, meta }: RecordViewSheetHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border bg-card px-6 pb-4 pt-6">
      <SheetHeader className="space-y-2.5 pr-10 text-left">
        <SheetTitle className="text-xl font-semibold leading-tight tracking-tight">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </SheetDescription>
        ) : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </SheetHeader>
    </div>
  );
}

export function RecordViewSheetBody({ children, className }: RecordViewSheetBodyProps) {
  return (
    <div className={cn("flex-1 space-y-4 overflow-y-auto bg-muted/35 px-5 py-4", className)}>{children}</div>
  );
}

export function RecordViewSheetSection({
  title,
  icon: Icon,
  headerAction,
  children,
  className,
  padding = "default",
}: RecordViewSheetSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <Icon className="size-4 shrink-0 text-primary" />
            ) : (
              <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary/80" aria-hidden />
            )}
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/75">
              {title}
            </h3>
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className={cn(padding === "relaxed" ? "p-4" : "px-0 py-0")}>{children}</div>
    </section>
  );
}

export function RecordViewSheetDetailRow({ label, value }: RecordViewSheetDetailRowProps) {
  if (isPlaceholderValue(value)) return null;

  return (
    <div className="grid grid-cols-[minmax(6.5rem,38%)_1fr] items-baseline gap-x-4 border-b border-border/80 px-4 py-2.5 last:border-b-0 odd:bg-muted/25">
      <span className="text-xs font-medium leading-snug text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm font-medium leading-snug text-foreground">
        {value}
      </span>
    </div>
  );
}

export function RecordViewSheetActions({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  isDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
}: RecordViewSheetActionsProps) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className="shrink-0 border-t border-border bg-card px-6 py-4">
      <div className="flex gap-2">
        {onEdit ? (
          <Button className="flex-1" onClick={onEdit} disabled={isDisabled || editDisabled}>
            <Pencil className="h-4 w-4" />
            {editLabel}
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            variant="outline"
            disabled={isDisabled || deleteDisabled}
            className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            {deleteLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
