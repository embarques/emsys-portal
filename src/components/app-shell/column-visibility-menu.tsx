"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Columns3, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import { cn } from "@/lib/utils";

type ColumnVisibilityMenuProps = {
  columnLayout: TableColumnLayout;
};

export function ColumnVisibilityMenu({ columnLayout }: ColumnVisibilityMenuProps) {
  const { columns, isVisible, setColumnVisible, reorderColumns, moveColumn, showAllColumns, resetColumns } =
    columnLayout;

  const [open, setOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (columns.length === 0) return null;

  function handleDrop(targetId: string) {
    if (draggingId && draggingId !== targetId) {
      reorderColumns(draggingId, targetId);
    }
    setDraggingId(null);
    setDragOverId(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 shrink-0 gap-2 px-3 text-sm font-medium shadow-xs"
        onClick={() => setOpen(true)}
      >
        <Columns3 className="h-4 w-4" />
        Columns
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize columns</DialogTitle>
            <DialogDescription>
              Drag to reorder columns here or from the table headers. Drag column edges in the table to resize width.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {columns.map((column, index) => {
              const locked = column.hideable === false;
              const columnLabel = formatTableColumnLabel(column.label);

              return (
                <div
                  key={column.id}
                  draggable
                  onDragStart={() => setDraggingId(column.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(column.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === column.id) setDragOverId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop(column.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors",
                    draggingId === column.id && "opacity-50",
                    dragOverId === column.id && draggingId !== column.id && "border-primary bg-primary/5"
                  )}
                >
                  <button
                    type="button"
                    className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                    aria-label={`Drag to reorder ${columnLabel}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  <input
                    type="checkbox"
                    checked={isVisible(column.id)}
                    disabled={locked}
                    onChange={(event) => setColumnVisible(column.id, event.target.checked)}
                    className="size-4 rounded border-input disabled:opacity-60"
                    aria-label={`Toggle ${columnLabel}`}
                  />

                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{columnLabel}</span>

                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      aria-label={`Move ${columnLabel} up`}
                      onClick={() => moveColumn(column.id, "up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === columns.length - 1}
                      aria-label={`Move ${columnLabel} down`}
                      onClick={() => moveColumn(column.id, "down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={showAllColumns}>
                Show all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetColumns}>
                Reset to default
              </Button>
            </div>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
