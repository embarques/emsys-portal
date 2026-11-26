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
import { useTranslation } from "@/lib/i18n";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
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
  compact?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  /**
   * Optional leading icon in a soft chip — matches section-card icon treatment.
   * Decorative only (`aria-hidden`); keep meaning in the title / eyebrow.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Small uppercase label above the title (e.g. entity type), matching
   * `RecordViewSheetSection` header typography.
   */
  eyebrow?: React.ReactNode;
  /**
   * Immutable / read-only shortcuts on the meta row, right-aligned
   * (print, download, export, open/view). Put mutating actions in
   * `RecordViewSheetActions` / the sheet footer instead.
   */
  actions?: React.ReactNode;
};

type RecordViewSheetBodyProps = {
  children: React.ReactNode;
  className?: string;
} & Pick<React.HTMLAttributes<HTMLDivElement>, "id" | "role" | "aria-labelledby">;

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
  labelClassName?: string;
  value: React.ReactNode;
  /** `end` keeps the label left and pushes the value to the right edge (line items, totals). */
  valueAlign?: "start" | "end";
  /**
   * `stacked` places the value under the label (same pattern as address/phone action rows).
   * Default `inline` keeps the two-column label | value grid.
   */
  layout?: "inline" | "stacked";
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
  /** Extra controls rendered before Edit/Delete (e.g. Actions menu + Print). */
  leading?: React.ReactNode;
  /** Optional content below the action buttons (e.g. delivery notices). */
  children?: React.ReactNode;
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
      onOpenAutoFocus={(event) => {
        // The close button is rendered after children, so default focus would
        // land on the first action control (e.g. phone "Copy") and open its
        // Tooltip. Keep focus on the sheet container instead.
        event.preventDefault();
        const target = event.currentTarget;
        if (target instanceof HTMLElement) {
          target.focus();
        }
      }}
    >
      {children}
    </SheetContent>
  );
}

export function RecordViewSheetHeader({
  title,
  description,
  meta,
  icon: Icon,
  eyebrow,
  actions,
  compact = false,
}: RecordViewSheetHeaderProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border-b border-border",
        "bg-gradient-to-br from-muted/70 via-card to-card",
        compact ? "px-5 py-3" : "px-6 pb-4 pt-5",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/40 to-transparent"
        aria-hidden
      />
      <SheetHeader className={cn("relative pr-10 text-left", compact ? "space-y-2" : "space-y-3")}>
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-primary shadow-sm",
                compact ? "size-9" : "size-10",
              )}
              aria-hidden
            >
              <Icon className={compact ? "size-4" : "size-5"} />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/75">
                {eyebrow}
              </p>
            ) : null}
            <SheetTitle className="text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </SheetDescription>
            ) : null}
          </div>
        </div>
        {meta || actions ? (
          <div className="flex flex-wrap items-center gap-2">
            {meta ? <div className="flex min-w-0 flex-wrap items-center gap-2">{meta}</div> : null}
            {actions ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </SheetHeader>
    </div>
  );
}

export function RecordViewSheetBody({ children, className, ...props }: RecordViewSheetBodyProps) {
  return (
    <div {...props} className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/35 px-5 py-4", className)}>
      {children}
    </div>
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

export function RecordViewSheetDetailRow({
  label,
  labelClassName,
  value,
  valueAlign = "start",
  layout = "inline",
}: RecordViewSheetDetailRowProps) {
  if (isPlaceholderValue(value)) return null;

  if (layout === "stacked") {
    return (
      <div className="border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25">
        <p
          className={cn(
            "min-w-0 text-xs font-medium leading-snug text-muted-foreground [overflow-wrap:anywhere]",
            labelClassName,
          )}
        >
          {label}
        </p>
        <div className="min-w-0 whitespace-pre-wrap text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
          {value}
        </div>
      </div>
    );
  }

  if (valueAlign === "end") {
    return (
      <div className="flex items-baseline justify-between gap-4 border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25">
        <span className={cn("min-w-0 text-xs font-medium leading-snug text-muted-foreground [overflow-wrap:anywhere]", labelClassName)}>{label}</span>
        <span className="max-w-[65%] shrink-0 whitespace-pre-wrap text-right text-sm font-medium leading-snug tabular-nums text-foreground [overflow-wrap:anywhere]">
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(6.5rem,38%)_1fr] items-baseline gap-x-4 border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25">
      <span className={cn("text-xs font-medium leading-snug text-muted-foreground", labelClassName)}>{label}</span>
      <span className="min-w-0 whitespace-pre-wrap text-right text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}

export function RecordViewSheetActions({
  onEdit,
  onDelete,
  leading,
  children,
  editLabel: editLabelProp,
  deleteLabel: deleteLabelProp,
  isDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
}: RecordViewSheetActionsProps) {
  const { t } = useTranslation();
  const editLabel = editLabelProp ?? t("common.actions.edit");
  const deleteLabel = deleteLabelProp ?? t("common.actions.delete");

  if (!onEdit && !onDelete && !leading && !children) return null;

  return (
    <div className="flex min-h-12 shrink-0 flex-col justify-center gap-3 border-t border-border bg-card px-6 py-2">
      {onEdit || onDelete || leading ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {leading ? (
            <div className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5">{leading}</div>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
              onClick={onEdit}
              disabled={isDisabled || editDisabled}
            >
              <Pencil className="h-4 w-4" />
              {editLabel}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled || deleteDisabled}
              className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {deleteLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
}
