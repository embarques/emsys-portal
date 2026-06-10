import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatCardsGridProps = {
  children: ReactNode;
  className?: string;
};

/** Distributes summary/stat cards evenly across the full row width. */
export function StatCardsGrid({ children, className }: StatCardsGridProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-stretch", className)}>
      {Children.map(children, (child) =>
        isValidElement(child) ? (
          <div key={child.key} className="flex min-w-0 flex-1 flex-col [&>*]:h-full">
            {child}
          </div>
        ) : null,
      )}
    </div>
  );
}
