"use client";

import { useEffect } from "react";

import { useUpdateWorkspaceTabLabel } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { store } from "@/lib/store/store";

/**
 * Updates the scoped workspace tab title (e.g. "Invoice #489391" while a detail view is open).
 * Reverts to `defaultLabel` when `title` is null/undefined.
 */
export function useSyncWorkspaceTabTitle(title: string | null | undefined, defaultLabel: string) {
  const scope = useWorkspaceTabScope();
  const tabId = scope?.tabId ?? null;
  const isActive = scope?.isActive ?? false;
  const updateLabel = useUpdateWorkspaceTabLabel();

  useEffect(() => {
    if (!tabId || !isActive) return;

    const nextLabel = title?.trim() || defaultLabel;
    const tab = store.getState().layoutTabs.tabs.find((entry) => entry.id === tabId);
    if (tab?.label === nextLabel) return;

    updateLabel(tabId, nextLabel);
  }, [defaultLabel, isActive, tabId, title, updateLabel]);
}
