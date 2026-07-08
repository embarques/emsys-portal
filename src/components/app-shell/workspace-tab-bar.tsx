"use client";

import { memo, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { WorkspaceTabColorMenu } from "@/components/app-shell/workspace-tab-color-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { WorkspaceTabOverflowMenu } from "@/components/app-shell/workspace-tab-overflow-menu";
import { Button } from "@/components/ui/button";
import { useUpdateWorkspaceTabColor, useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { getWorkspaceTabChromeStyle } from "@/lib/layout/workspace-tab-colors";
import { getWorkspaceTabDisplayLabel, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import { WORKSPACE_TAB_OVERFLOW_THRESHOLD } from "@/lib/layout/workspace-tab-types";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type WorkspaceTabItemProps = {
  tab: WorkspaceTab;
  displayLabel: string;
  active: boolean;
  index: number;
  totalTabs: number;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onCloseAll: () => void;
  onDuplicate: (tab: WorkspaceTab) => void;
  onColorChange: (tabId: string, color: string | null) => void;
  tabRef?: (node: HTMLDivElement | null) => void;
};

const WorkspaceTabItem = memo(function WorkspaceTabItem({
  tab,
  displayLabel,
  active,
  index,
  totalTabs,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onDuplicate,
  onColorChange,
  tabRef,
}: WorkspaceTabItemProps) {
  const { t } = useTranslation();
  const hasTabsToRight = index < totalTabs - 1;
  const hasOtherTabs = totalTabs > 1;
  const colorStyle = getWorkspaceTabChromeStyle(tab.color, active);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={tabRef}
          data-tab-id={tab.id}
          style={colorStyle}
          className={cn(
            "group mr-1 mt-1.5 flex min-w-0 max-w-[220px] shrink-0 cursor-default items-center rounded-t-lg border px-3 py-2 text-sm transition",
            active
              ? "relative z-10 -mb-px border-border border-b-background font-medium text-foreground shadow-[0_1px_0_0_var(--background),0_-1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_var(--background),0_-1px_4px_rgba(0,0,0,0.25)]"
              : "mb-0 border-transparent border-b-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            tab.color
              ? active
                ? "bg-background"
                : "bg-muted/50 hover:brightness-[0.98]"
              : active
                ? "border-t-2 border-t-primary bg-background"
                : "bg-muted/50 hover:bg-muted/70",
          )}
        >
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => onActivate(tab.id)}
            title={`${tab.number} · ${displayLabel}`}
          >
            <span
              className={cn(
                "mr-1.5 shrink-0 tabular-nums",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {tab.number}
            </span>
            <span className="truncate">{displayLabel}</span>
          </button>
          <button
            type="button"
            className="ml-2 rounded p-0.5 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label={t("shell.tabs.close", { label: displayLabel })}
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => onDuplicate(tab)}>{t("shell.tabs.openInNewTab")}</ContextMenuItem>
        <WorkspaceTabColorMenu tabId={tab.id} currentColor={tab.color} onColorChange={onColorChange} />
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onClose(tab.id)}>{t("shell.tabs.closeTab")}</ContextMenuItem>
        <ContextMenuItem disabled={!hasOtherTabs} onSelect={() => onCloseOthers(tab.id)}>
          {t("shell.tabs.closeOtherTabs")}
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasTabsToRight} onSelect={() => onCloseToRight(tab.id)}>
          {t("shell.tabs.closeTabsToRight")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onCloseAll()}>{t("shell.tabs.closeAllTabs")}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

export function WorkspaceTabBar() {
  const { locale, t } = useTranslation();
  const { tabs, activeTabId, activateTab, closeTab, closeOtherTabs, closeTabsToRight, closeAllTabs, openTab } =
    useWorkspaceTabs();
  const updateTabColor = useUpdateWorkspaceTabColor();
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
              displayLabel={getWorkspaceTabDisplayLabel(tab, locale)}
              index={index}
              totalTabs={tabs.length}
              active={tab.id === activeTabId}
              onActivate={activateTab}
              onClose={closeTab}
              onCloseOthers={closeOtherTabs}
              onCloseToRight={closeTabsToRight}
              onCloseAll={closeAllTabs}
              onDuplicate={(tab) => openTab(tab.href, resolveWorkspaceLabel(tab.href, locale), { forceNew: true })}
              onColorChange={updateTabColor}
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
        {tabs.length >= 2 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="workspace-close-all-tabs"
            className="mb-1 mr-1 mt-2 h-9 shrink-0 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label={t("shell.tabs.closeAllTabs")}
            title={t("shell.tabs.closeAllTabs")}
            onClick={closeAllTabs}
          >
            {t("shell.tabs.closeAll")}
          </Button>
        ) : null}
        {showOverflowMenu ? (
          <WorkspaceTabOverflowMenu
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={activateTab}
            onCloseAll={closeAllTabs}
          />
        ) : null}
      </div>
    </div>
  );
}
