"use client";

import { cn } from "@/lib/utils";

export type RecordViewSheetTabOption<T extends string> = {
  id: T;
  label: string;
};

type RecordViewSheetTabsProps<T extends string> = {
  tabs: RecordViewSheetTabOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Prefix for tab / panel ids (`{idPrefix}-tab-{id}`, `{idPrefix}-panel-{id}`). */
  idPrefix: string;
  "aria-label": string;
  className?: string;
};

/**
 * In-sheet tab strip styled like workspace app tabs (folder chrome + top accent),
 * without close buttons or tab numbers.
 */
export function RecordViewSheetTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  idPrefix,
  "aria-label": ariaLabel,
  className,
}: RecordViewSheetTabsProps<T>) {
  function focusTab(tabId: T) {
    const el = document.getElementById(`${idPrefix}-tab-${tabId}`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function selectTab(tabId: T) {
    onValueChange(tabId);
    requestAnimationFrame(() => {
      document
        .getElementById(`${idPrefix}-tab-${tabId}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        // Match RecordViewSheetBody (`px-5`) so the first tab lines up with section cards.
        "flex items-end overflow-x-auto border-b bg-muted/30 px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => {
              let nextIndex: number | undefined;
              if (event.key === "ArrowLeft") {
                nextIndex = (index - 1 + tabs.length) % tabs.length;
              } else if (event.key === "ArrowRight") {
                nextIndex = (index + 1) % tabs.length;
              } else if (event.key === "Home") {
                nextIndex = 0;
              } else if (event.key === "End") {
                nextIndex = tabs.length - 1;
              }
              if (nextIndex === undefined) return;
              const next = tabs[nextIndex];
              if (!next) return;
              event.preventDefault();
              onValueChange(next.id);
              focusTab(next.id);
            }}
            className={cn(
              "relative mt-1.5 mr-1 shrink-0 overflow-hidden rounded-t-lg border px-3 py-2 text-sm transition",
              selected
                ? "z-10 -mb-px border-border border-b-background border-t-2 border-t-primary bg-background font-medium text-foreground shadow-[0_1px_0_0_var(--background),0_-1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_var(--background),0_-1px_4px_rgba(0,0,0,0.25)]"
                : "border-transparent border-b-transparent bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
