"use client";

import { createContext, useContext } from "react";

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
  return (
    <WorkspaceTabScopeContext.Provider value={{ tabId, isActive }}>{children}</WorkspaceTabScopeContext.Provider>
  );
}

export function useWorkspaceTabScope() {
  return useContext(WorkspaceTabScopeContext)?.tabId ?? null;
}

/** False when the workspace tab is mounted but hidden; true otherwise. */
export function useWorkspaceTabQueriesEnabled() {
  const scope = useContext(WorkspaceTabScopeContext);
  if (!scope) return true;
  return scope.isActive;
}
