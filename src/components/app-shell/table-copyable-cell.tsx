"use client";

import { cn } from "@/lib/utils";

type TableCopyableCellProps = {
  value: string;
  children?: React.ReactNode;
  truncate?: boolean;
  className?: string;
};

/** Selectable table cell text. Highlight to copy; row click is suppressed while text is selected. */
export function TableCopyableCell({
  value,
  children,
  truncate = true,
  className,
}: TableCopyableCellProps) {
  return (
    <span
      className={cn(
        "min-w-0 cursor-text select-text",
        truncate
          ? "block truncate"
          : "whitespace-normal break-words [overflow-wrap:break-word]",
        className,
      )}
    >
      {children ?? value}
    </span>
  );
}
