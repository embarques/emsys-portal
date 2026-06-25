import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Keep only text-color utility classes from a badge/pill className,
 * dropping pill surfaces (background, border, ring, rounded, padding, shadow).
 * Variant prefixes like `dark:` are preserved.
 */
export function pillTextClass(className?: string): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter((token) => token && token.replace(/^[\w-]+:/, "").startsWith("text-"))
    .join(" ");
}

type TableTagTextProps = {
  /** A badge className whose text color is reused (surfaces are stripped). */
  className?: string;
  children: React.ReactNode;
};

/**
 * Renders a table cell value as bold, colored text instead of a pill/badge —
 * keeps the font weight and color, removes the pill background and border.
 */
export function TableTagText({ className, children }: TableTagTextProps) {
  return <span className={cn("font-semibold", pillTextClass(className))}>{children}</span>;
}
