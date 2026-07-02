"use client";

import { createContext, useContext, useMemo } from "react";

type WorkspaceTabScopeValue = {
  tabId: string;
  isActive: boolean;
};

const WorkspaceTabScopeContext = createContext<WorkspaceTabScopeValue | null>(null);

type WorkspaceTabScopeProps = {
  tabId: string;
  isActive: boolean;
  children: React.ReactNode;
};

export function WorkspaceTabScope({ tabId, isActive, children }: WorkspaceTabScopeProps) {
  const value = useMemo(() => ({ tabId, isActive }), [isActive, tabId]);

  return (
    <WorkspaceTabScopeContext.Provider value={value}>{children}</WorkspaceTabScopeContext.Provider>
  );
}

export function useWorkspaceTabScope() {
  return useContext(WorkspaceTabScopeContext);
}

/** False when the workspace tab is mounted but hidden; true otherwise. */
export function useWorkspaceTabQueriesEnabled() {
  const scope = useContext(WorkspaceTabScopeContext);
  if (!scope) return true;
  return scope.isActive;
}
