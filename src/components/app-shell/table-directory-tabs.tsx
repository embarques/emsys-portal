"use client";

import { cn } from "@/lib/utils";

export type TableDirectoryTab<T extends string> = {
  id: T;
  label: string;
};

type TableDirectoryTabsProps<T extends string> = {
  tabs: TableDirectoryTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
};

export function TableDirectoryTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  "aria-label": ariaLabel = "Directory views",
  className,
}: TableDirectoryTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex gap-1", className)}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`directory-panel-${tab.id}`}
            id={`directory-tab-${tab.id}`}
            onClick={() => onValueChange(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
