"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { useConfigurationStore } from "@/lib/configuration/use-configuration";
import { buildWorkspaceTabUrl, pathnameFromHref, readWorkspaceTabNumber } from "@/lib/layout/workspace-tab-url";
import { isWorkspaceRoute, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import {
  findTabByNumber,
  hydrateWorkspaceTabs,
  enforceWorkspaceTabLimit,
  openWorkspaceTab,
  readPersistedWorkspaceTabs,
  setActiveWorkspaceTab,
} from "@/lib/store/layout/tabs-slice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";

function createTabId() {
  return crypto.randomUUID();
}

/** Prevents duplicate auto-open for the same location (e.g. React Strict Mode remounts). */
let pendingAutoOpenLocation: string | null = null;

/**
 * Runs tab hydration and URL synchronization once for the whole dashboard shell.
 * Must be mounted exactly once (inside Suspense) — not per sidebar link.
 */
export function WorkspaceTabsSync() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktopTabs = useIsDesktopWorkspaceTabs();
  const { language, maxWorkspaceTabs } = useConfigurationStore();
  const tabs = useAppSelector((state) => state.layoutTabs.tabs);
  const activeTabId = useAppSelector((state) => state.layoutTabs.activeTabId);

  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isDesktopTabs || hydratedRef.current) return;

    const persisted = readPersistedWorkspaceTabs();
    if (persisted && persisted.tabs.length > 0) {
      dispatch(hydrateWorkspaceTabs(persisted));
    }

    hydratedRef.current = true;
    setHydrated(true);
  }, [dispatch, isDesktopTabs]);

  useEffect(() => {
    if (!isDesktopTabs || !hydrated) return;
    dispatch(enforceWorkspaceTabLimit());
  }, [dispatch, hydrated, isDesktopTabs, maxWorkspaceTabs]);

  useEffect(() => {
    if (!isDesktopTabs || !hydrated) return;
    if (!isWorkspaceRoute(pathname)) return;

    const locationKey = `${pathname}?${searchParams.toString()}`;
    const tabNumberFromUrl = readWorkspaceTabNumber(searchParams);
    const { tabs: currentTabs, activeTabId: currentActiveTabId } = store.getState().layoutTabs;

    if (tabNumberFromUrl != null) {
      pendingAutoOpenLocation = null;
      const existing = findTabByNumber(currentTabs, tabNumberFromUrl);

      if (existing) {
        if (currentActiveTabId !== existing.id) {
          dispatch(setActiveWorkspaceTab(existing.id));
        }
        return;
      }

      const tabOnCurrentRoute = currentTabs.find((tab) => pathnameFromHref(tab.href) === pathname);
      if (tabOnCurrentRoute) {
        if (currentActiveTabId !== tabOnCurrentRoute.id) {
          dispatch(setActiveWorkspaceTab(tabOnCurrentRoute.id));
        }
        router.replace(buildWorkspaceTabUrl(tabOnCurrentRoute.href, tabOnCurrentRoute.number));
        return;
      }

      const tabId = createTabId();
      dispatch(
        openWorkspaceTab({
          id: tabId,
          href: pathname,
          label: resolveWorkspaceLabel(pathname, language),
        }),
      );

      const opened = store.getState().layoutTabs.tabs.find((tab) => tab.id === tabId);
      if (opened) {
        router.replace(buildWorkspaceTabUrl(pathname, opened.number));
      }
      return;
    }

    if (pathname === "/") {
      pendingAutoOpenLocation = null;
      return;
    }

    const existingOnRoute = currentTabs.find((tab) => pathnameFromHref(tab.href) === pathname);
    if (existingOnRoute) {
      pendingAutoOpenLocation = null;
      if (currentActiveTabId !== existingOnRoute.id) {
        dispatch(setActiveWorkspaceTab(existingOnRoute.id));
      }
      router.replace(buildWorkspaceTabUrl(existingOnRoute.href, existingOnRoute.number));
      return;
    }

    // Guard duplicate auto-open (e.g. React Strict Mode). Retry if no tab was created yet.
    if (pendingAutoOpenLocation === locationKey) return;

    pendingAutoOpenLocation = locationKey;
    const tabId = createTabId();
    dispatch(
      openWorkspaceTab({
        id: tabId,
        href: pathname,
        label: resolveWorkspaceLabel(pathname, language),
      }),
    );

    const opened = store.getState().layoutTabs.tabs.find((tab) => tab.id === tabId);
    if (opened) {
      router.replace(buildWorkspaceTabUrl(pathname, opened.number));
    }
  }, [dispatch, isDesktopTabs, hydrated, language, pathname, router, searchParams]);

  useEffect(() => {
    if (!isDesktopTabs || !hydrated) return;
    if (!activeTabId) return;

    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;
    if (pathnameFromHref(activeTab.href) !== pathname) return;

    const tabNumberFromUrl = readWorkspaceTabNumber(searchParams);
    if (tabNumberFromUrl === activeTab.number) return;

    router.replace(buildWorkspaceTabUrl(activeTab.href, activeTab.number));
  }, [activeTabId, isDesktopTabs, hydrated, pathname, router, searchParams, tabs]);

  return null;
}
