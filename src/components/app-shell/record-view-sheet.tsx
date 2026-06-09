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
  children: React.ReactNode;
  className?: string;
  padding?: "default" | "relaxed";
};

type RecordViewSheetDetailRowProps = {
  label: string;
  value: React.ReactNode;
};

type RecordViewSheetActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  isDisabled?: boolean;
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
    <div className="shrink-0 border-b bg-muted/20 px-6 pb-5 pt-6">
      <SheetHeader className="space-y-3 pr-10 text-left">
        <SheetTitle className="text-xl leading-tight">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="text-sm leading-relaxed">{description}</SheetDescription>
        ) : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-0.5">{meta}</div> : null}
      </SheetHeader>
    </div>
  );
}

export function RecordViewSheetBody({ children, className }: RecordViewSheetBodyProps) {
  return (
    <div className={cn("flex-1 space-y-5 overflow-y-auto px-6 py-5", className)}>{children}</div>
  );
}

export function RecordViewSheetSection({
  title,
  children,
  className,
  padding = "default",
}: RecordViewSheetSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-sm",
        className,
      )}
    >
      {title ? (
        <div className="border-b border-border/60 bg-muted/25 px-5 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        </div>
      ) : null}
      <div className={cn(padding === "relaxed" ? "p-5" : "px-0 py-1")}>{children}</div>
    </section>
  );
}

export function RecordViewSheetDetailRow({ label, value }: RecordViewSheetDetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/50 px-5 py-3 last:border-b-0">
      <span className="min-w-0 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 max-w-[58%] break-words text-right text-sm font-medium leading-snug">
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
}: RecordViewSheetActionsProps) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className="shrink-0 border-t bg-background px-6 py-4">
      <div className="flex gap-3">
        {onEdit ? (
          <Button className="flex-1" onClick={onEdit} disabled={isDisabled}>
            <Pencil className="h-4 w-4" />
            {editLabel}
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="destructive" onClick={onDelete} disabled={isDisabled}>
            <Trash2 className="h-4 w-4" />
            {deleteLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
