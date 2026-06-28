"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { buildWorkspaceTabUrl, readWorkspaceTabId } from "@/lib/layout/workspace-tab-url";
import { isWorkspaceRoute, resolveWorkspaceLabel } from "@/lib/layout/workspace-registry";
import {
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
    const tabIdFromUrl = readWorkspaceTabId(searchParams);
    const { tabs: currentTabs, activeTabId: currentActiveTabId } = store.getState().layoutTabs;

    if (tabIdFromUrl) {
      pendingAutoOpenLocation = null;
      const existing = currentTabs.find((tab) => tab.id === tabIdFromUrl);

      if (existing) {
        if (currentActiveTabId !== tabIdFromUrl) {
          dispatch(setActiveWorkspaceTab(tabIdFromUrl));
        }
        return;
      }

      dispatch(
        openWorkspaceTab({
          id: tabIdFromUrl,
          href: pathname,
          label: resolveWorkspaceLabel(pathname),
        }),
      );
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
    router.replace(buildWorkspaceTabUrl(pathname, tabId));
  }, [dispatch, isDesktopTabs, pathname, router, searchParams]);

  return null;
}
