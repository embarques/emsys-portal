export const WORKSPACE_TAB_PARAM = "tab";

export const WORKSPACE_TABS_STORAGE_KEY = "emsys-workspace-tabs";

/** Maximum open workspace tabs before the oldest tab is closed automatically. */
export const MAX_WORKSPACE_TABS = 12;

/** Show the tab overflow menu when at least this many tabs are open. */
export const WORKSPACE_TAB_OVERFLOW_THRESHOLD = 6;

export type WorkspaceTab = {
  id: string;
  href: string;
  /** Display title — can be updated dynamically (e.g. "Invoice #489391"). */
  label: string;
};

export type WorkspaceTabsState = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
};

export type PersistedWorkspaceTabs = WorkspaceTabsState;
