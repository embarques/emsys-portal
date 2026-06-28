"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { WorkspaceTabOverflowMenu } from "@/components/app-shell/workspace-tab-overflow-menu";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { WORKSPACE_TAB_OVERFLOW_THRESHOLD } from "@/lib/layout/workspace-tab-types";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { cn } from "@/lib/utils";

type WorkspaceTabItemProps = {
  tab: WorkspaceTab;
  active: boolean;
  index: number;
  totalTabs: number;
  tabRef?: (node: HTMLDivElement | null) => void;
};

function WorkspaceTabItem({ tab, active, index, totalTabs, tabRef }: WorkspaceTabItemProps) {
  const { activateTab, closeTab, closeOtherTabs, closeTabsToRight } = useWorkspaceTabs();
  const hasTabsToRight = index < totalTabs - 1;
  const hasOtherTabs = totalTabs > 1;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={tabRef}
          data-tab-id={tab.id}
          className={cn(
            "group mr-1 mt-2 flex min-w-0 max-w-[220px] shrink-0 items-center rounded-t-lg border border-b-0 px-3 py-2 text-sm transition",
            active
              ? "border-border bg-background text-foreground shadow-sm"
              : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => activateTab(tab.id)}
            title={tab.label}
          >
            {tab.label}
          </button>
          <button
            type="button"
            className="ml-2 rounded p-0.5 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label={`Close ${tab.label}`}
            onClick={(event) => {
              event.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => closeTab(tab.id)}>Close</ContextMenuItem>
        <ContextMenuItem disabled={!hasOtherTabs} onSelect={() => closeOtherTabs(tab.id)}>
          Close Other Tabs
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasTabsToRight} onSelect={() => closeTabsToRight(tab.id)}>
          Close Tabs to the Right
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function WorkspaceTabBar() {
  const { tabs, activeTabId, activateTab } = useWorkspaceTabs();
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  const [hasScrollOverflow, setHasScrollOverflow] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateOverflow = () => {
      setHasScrollOverflow(element.scrollWidth > element.clientWidth + 1);
    };

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    element.addEventListener("scroll", updateOverflow);

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", updateOverflow);
    };
  }, [tabs]);

  useEffect(() => {
    if (!activeTabId) return;
    const activeElement = tabRefs.current.get(activeTabId);
    activeElement?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs]);

  if (tabs.length === 0) {
    return null;
  }

  const showOverflowMenu = tabs.length >= WORKSPACE_TAB_OVERFLOW_THRESHOLD || hasScrollOverflow;

  return (
    <div className="border-b bg-muted/30">
      <div className="mx-auto flex w-full max-w-[1600px] items-end px-2 md:px-4">
        <div ref={scrollRef} className="flex min-w-0 flex-1 items-end overflow-x-auto">
          {tabs.map((tab, index) => (
            <WorkspaceTabItem
              key={tab.id}
              tab={tab}
              index={index}
              totalTabs={tabs.length}
              active={tab.id === activeTabId}
              tabRef={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
            />
          ))}
        </div>
        {showOverflowMenu ? (
          <WorkspaceTabOverflowMenu tabs={tabs} activeTabId={activeTabId} onActivate={activateTab} />
        ) : null}
      </div>
    </div>
  );
}
