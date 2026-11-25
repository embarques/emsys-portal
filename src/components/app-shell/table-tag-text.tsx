import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TableTagTextProps = {
  /** Badge/pill color classes (background + text). */
  className?: string;
  children: React.ReactNode;
};

/**
 * Table status/tag cell: colored pill with text centered vertically and
 * horizontally. No icons — pass label text only.
 */
export function TableTagText({ className, children }: TableTagTextProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-center font-semibold leading-none",
        className ?? "border-transparent bg-muted text-muted-foreground",
      )}
    >
      {children}
    </Badge>
  );
}
