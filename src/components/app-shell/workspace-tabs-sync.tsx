"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { buildWorkspaceTabUrl, readWorkspaceTabNumber } from "@/lib/layout/workspace-tab-url";
import { isWorkspaceRoute, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import {
  findTabByNumber,
  hydrateWorkspaceTabs,
  openWorkspaceTab,
  readPersistedWorkspaceTabs,
  setActiveWorkspaceTab,
} from "@/lib/store/layout/tabs-slice";
import { useAppDispatch } from "@/lib/store/hooks";
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

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!isDesktopTabs || hydratedRef.current) return;

    const persisted = readPersistedWorkspaceTabs();
    if (persisted && persisted.tabs.length > 0) {
      dispatch(hydrateWorkspaceTabs(persisted));
    }

    hydratedRef.current = true;
  }, [dispatch, isDesktopTabs]);

  useEffect(() => {
    if (!isDesktopTabs || !hydratedRef.current) return;
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

      const tabId = createTabId();
      dispatch(
        openWorkspaceTab({
          id: tabId,
          href: pathname,
          label: resolveWorkspaceLabel(pathname),
          number: tabNumberFromUrl,
        }),
      );

      const opened = findTabByNumber(store.getState().layoutTabs.tabs, tabNumberFromUrl);
      if (opened && opened.number !== tabNumberFromUrl) {
        router.replace(buildWorkspaceTabUrl(pathname, opened.number));
      }
      return;
    }

    if (pathname === "/") {
      pendingAutoOpenLocation = null;
      return;
    }

    if (pendingAutoOpenLocation === locationKey) return;

    pendingAutoOpenLocation = locationKey;
    const tabId = createTabId();
    dispatch(
      openWorkspaceTab({
        id: tabId,
        href: pathname,
        label: resolveWorkspaceLabel(pathname),
      }),
    );

    const opened = store.getState().layoutTabs.tabs.find((tab) => tab.id === tabId);
    if (opened) {
      router.replace(buildWorkspaceTabUrl(pathname, opened.number));
    }
  }, [dispatch, isDesktopTabs, pathname, router, searchParams]);

  return null;
}
