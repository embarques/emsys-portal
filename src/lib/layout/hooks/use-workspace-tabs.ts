"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { buildWorkspaceTabUrl } from "@/lib/layout/workspace-tab-url";
import { isWorkspaceRoute, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import { type WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { getMaxWorkspaceTabs } from "@/lib/layout/workspace-tab-limits";
import { pathnameFromHref } from "@/lib/layout/workspace-tab-url";
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  closeWorkspaceTabsToRight,
  findTabByHref,
  openWorkspaceTab,
  resetWorkspaceTabs,
  setActiveWorkspaceTab,
  updateWorkspaceTabLabel,
} from "@/lib/store/layout/tabs-slice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";

function createTabId() {
  return crypto.randomUUID();
}

export type OpenWorkspaceTabOptions = {
  /** When true, always create a new tab even if one for this route already exists. */
  forceNew?: boolean;
};

function getActiveTabFromStore() {
  const { tabs, activeTabId } = store.getState().layoutTabs;
  return tabs.find((tab) => tab.id === activeTabId);
}

export function useWorkspaceTabs() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isDesktopTabs = useIsDesktopWorkspaceTabs();
  const { notifySuccess } = useFeedback();

  const tabs = useAppSelector((state) => state.layoutTabs.tabs);
  const activeTabId = useAppSelector((state) => state.layoutTabs.activeTabId);

  const navigateToTab = useCallback(
    (tab: Pick<WorkspaceTab, "href" | "number">) => {
      router.push(buildWorkspaceTabUrl(tab.href, tab.number));
    },
    [router],
  );

  const syncActiveTabUrl = useCallback(() => {
    const activeTab = getActiveTabFromStore();
    if (!activeTab) return;
    navigateToTab(activeTab);
  }, [navigateToTab]);

  const openTab = useCallback(
    (href: string, label?: string, options: OpenWorkspaceTabOptions = {}) => {
      if (!isDesktopTabs) {
        router.push(href);
        return;
      }

      const pathnameOnly = pathnameFromHref(href);
      if (!isWorkspaceRoute(pathnameOnly)) {
        router.push(href);
        return;
      }

      if (!options.forceNew) {
        const existing = findTabByHref(store.getState().layoutTabs.tabs, pathnameOnly);
        if (existing) {
          dispatch(setActiveWorkspaceTab(existing.id));
          navigateToTab(existing);
          return;
        }
      }

      const maxTabs = getMaxWorkspaceTabs();
      const atLimit = tabs.length >= maxTabs;
      const tabId = createTabId();
      dispatch(
        openWorkspaceTab({
          id: tabId,
          href: pathnameOnly,
          label: label ?? resolveWorkspaceLabel(pathnameOnly),
        }),
      );

      if (atLimit) {
        notifySuccess(`Closed the oldest tab (maximum ${maxTabs} open).`);
      }

      const created = store.getState().layoutTabs.tabs.find((tab) => tab.id === tabId);
      if (created) {
        navigateToTab(created);
      }
    },
    [dispatch, isDesktopTabs, navigateToTab, notifySuccess, router, tabs.length],
  );

  const activateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((entry) => entry.id === tabId);
      if (!tab) return;
      dispatch(setActiveWorkspaceTab(tabId));
      navigateToTab(tab);
    },
    [dispatch, navigateToTab, tabs],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) return;

      const isActive = activeTabId === tabId;

      dispatch(closeWorkspaceTab(tabId));

      const { tabs: remaining, activeTabId: nextActiveTabId } = store.getState().layoutTabs;
      if (remaining.length === 0) {
        router.push("/");
        return;
      }

      if (isActive) {
        const nextTab = remaining.find((tab) => tab.id === nextActiveTabId);
        if (nextTab) {
          navigateToTab(nextTab);
        }
        return;
      }

      syncActiveTabUrl();
    },
    [activeTabId, dispatch, navigateToTab, router, syncActiveTabUrl, tabs],
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      if (!tabs.some((tab) => tab.id === tabId)) return;

      dispatch(closeOtherWorkspaceTabs(tabId));

      const kept = getActiveTabFromStore();
      if (kept) {
        navigateToTab(kept);
      }
    },
    [dispatch, navigateToTab, tabs],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index === -1 || index >= tabs.length - 1) return;

      const removedIds = new Set(tabs.slice(index + 1).map((tab) => tab.id));
      const activeWasRemoved = activeTabId != null && removedIds.has(activeTabId);

      dispatch(closeWorkspaceTabsToRight(tabId));

      if (activeWasRemoved) {
        const activeTab = getActiveTabFromStore();
        if (activeTab) {
          navigateToTab(activeTab);
        }
        return;
      }

      syncActiveTabUrl();
    },
    [activeTabId, dispatch, navigateToTab, syncActiveTabUrl, tabs],
  );

  const closeAllTabs = useCallback(() => {
    if (tabs.length === 0) return;
    dispatch(resetWorkspaceTabs());
    router.push("/");
  }, [dispatch, router, tabs.length]);

  return {
    tabs,
    activeTabId,
    isDesktopTabs,
    openTab,
    activateTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
  };
}

export function useUpdateWorkspaceTabLabel() {
  const dispatch = useAppDispatch();
  return useCallback(
    (id: string, label: string) => {
      dispatch(updateWorkspaceTabLabel({ id, label }));
    },
    [dispatch],
  );
}
