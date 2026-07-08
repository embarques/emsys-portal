"use client";

import { useRef } from "react";

import {
  createRowPointerState,
  shouldIgnoreRowClick,
  type RowPointerState,
} from "@/lib/table/row-click";
import { cn } from "@/lib/utils";

type InteractiveTableRowProps = React.ComponentPropsWithoutRef<"tr"> & {
  active?: boolean;
  interactive?: boolean;
  onRowClick?: () => void;
};

export function InteractiveTableRow({
  active,
  interactive,
  onRowClick,
  className,
  onClick,
  onMouseDown,
  children,
  ...props
}: InteractiveTableRowProps) {
  const pointerRef = useRef<RowPointerState | null>(null);
  const isInteractive = interactive ?? Boolean(onRowClick);

  function handleMouseDown(event: React.MouseEvent<HTMLTableRowElement>) {
    pointerRef.current = createRowPointerState(event.clientX, event.clientY);
    onMouseDown?.(event);
  }

  function handleClick(event: React.MouseEvent<HTMLTableRowElement>) {
    onClick?.(event);
    if (!onRowClick || event.defaultPrevented) return;

    if (shouldIgnoreRowClick(pointerRef.current, event.clientX, event.clientY, event.target)) {
      pointerRef.current = null;
      return;
    }

    pointerRef.current = null;
    onRowClick();
  }

  return (
    <tr
      {...props}
      className={cn(
        isInteractive && "cursor-pointer",
        "border-b transition-colors last:border-0 hover:bg-muted/25",
        active && "bg-primary/[0.06]",
        className,
      )}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {children}
    </tr>
  );
}
