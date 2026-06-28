"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { buildWorkspaceTabUrl } from "@/lib/layout/workspace-tab-url";
import { isWorkspaceRoute, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import { MAX_WORKSPACE_TABS, type WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  closeWorkspaceTabsToRight,
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

  const openTab = useCallback(
    (href: string, label?: string) => {
      if (!isDesktopTabs) {
        router.push(href);
        return;
      }

      const pathnameOnly = href.split("?")[0] ?? href;
      if (!isWorkspaceRoute(pathnameOnly)) {
        router.push(href);
        return;
      }

      const atLimit = tabs.length >= MAX_WORKSPACE_TABS;
      const tabId = createTabId();
      dispatch(
        openWorkspaceTab({
          id: tabId,
          href: pathnameOnly,
          label: label ?? resolveWorkspaceLabel(pathnameOnly),
        }),
      );

      if (atLimit) {
        notifySuccess(`Closed the oldest tab (maximum ${MAX_WORKSPACE_TABS} open).`);
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
      const remaining = tabs.filter((tab) => tab.id !== tabId);

      dispatch(closeWorkspaceTab(tabId));

      if (remaining.length === 0) {
        router.push("/");
        return;
      }

      if (isActive) {
        const nextTab = remaining[closingIndex] ?? remaining[closingIndex - 1] ?? remaining[0];
        navigateToTab(nextTab);
      }
    },
    [activeTabId, dispatch, navigateToTab, router, tabs],
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      const target = tabs.find((tab) => tab.id === tabId);
      if (!target) return;

      dispatch(closeOtherWorkspaceTabs(tabId));
      navigateToTab(target);
    },
    [dispatch, navigateToTab, tabs],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index === -1 || index >= tabs.length - 1) return;

      const target = tabs[index];
      const removedIds = new Set(tabs.slice(index + 1).map((tab) => tab.id));
      const activeWasRemoved = activeTabId != null && removedIds.has(activeTabId);

      dispatch(closeWorkspaceTabsToRight(tabId));

      if (activeWasRemoved) {
        navigateToTab(target);
      }
    },
    [activeTabId, dispatch, navigateToTab, tabs],
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
