"use client";

import { createContext, useContext, useMemo } from "react";

type WorkspaceTabScopeValue = {
  tabId: string;
  isActive: boolean;
  /** Host element for Dialog/Sheet portals so overlays stay inside this tab. */
  portalContainer: HTMLElement | null;
};

const WorkspaceTabScopeContext = createContext<WorkspaceTabScopeValue | null>(null);

type WorkspaceTabScopeProps = {
  tabId: string;
  isActive: boolean;
  portalContainer: HTMLElement | null;
  children: React.ReactNode;
};

export function WorkspaceTabScope({
  tabId,
  isActive,
  portalContainer,
  children,
}: WorkspaceTabScopeProps) {
  const value = useMemo(
    () => ({ tabId, isActive, portalContainer }),
    [isActive, portalContainer, tabId],
  );

  return (
    <WorkspaceTabScopeContext.Provider value={value}>{children}</WorkspaceTabScopeContext.Provider>
  );
}

export function useWorkspaceTabScope() {
  return useContext(WorkspaceTabScopeContext);
}

/** Portal host for tab-scoped overlays; null outside workspace tabs. */
export function useWorkspaceTabPortalContainer() {
  return useContext(WorkspaceTabScopeContext)?.portalContainer ?? null;
}

/** False when the workspace tab is mounted but hidden; true otherwise. */
export function useWorkspaceTabQueriesEnabled() {
  const scope = useContext(WorkspaceTabScopeContext);
  if (!scope) return true;
  return scope.isActive;
}
