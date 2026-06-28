"use client";

import { createContext, useContext } from "react";

const WorkspaceTabScopeContext = createContext<string | null>(null);

type WorkspaceTabScopeProps = {
  tabId: string;
  children: React.ReactNode;
};

export function WorkspaceTabScope({ tabId, children }: WorkspaceTabScopeProps) {
  return <WorkspaceTabScopeContext.Provider value={tabId}>{children}</WorkspaceTabScopeContext.Provider>;
}

export function useWorkspaceTabScope() {
  return useContext(WorkspaceTabScopeContext);
}
