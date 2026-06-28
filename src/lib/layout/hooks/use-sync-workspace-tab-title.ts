"use client";

import { useEffect } from "react";

import { useUpdateWorkspaceTabLabel } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";

/**
 * Updates the scoped workspace tab title (e.g. "Invoice #489391" while a detail view is open).
 * Reverts to `defaultLabel` when `title` is null/undefined.
 */
export function useSyncWorkspaceTabTitle(title: string | null | undefined, defaultLabel: string) {
  const tabId = useWorkspaceTabScope();
  const updateLabel = useUpdateWorkspaceTabLabel();

  useEffect(() => {
    if (!tabId) return;
    updateLabel(tabId, title?.trim() || defaultLabel);
  }, [defaultLabel, tabId, title, updateLabel]);
}
