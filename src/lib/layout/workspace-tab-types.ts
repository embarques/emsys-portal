export const WORKSPACE_TAB_PARAM = "tab";

export const WORKSPACE_TABS_STORAGE_KEY = "emsys-workspace-tabs";

/** Show the tab overflow menu when at least this many tabs are open. */
export const WORKSPACE_TAB_OVERFLOW_THRESHOLD = 6;

export type WorkspaceTab = {
  /** Internal stable key for React / keep-alive. */
  id: string;
  /** Sequential tab number shown in the URL and tab bar (1…n, renumbered when tabs close). */
  number: number;
  href: string;
  /** Display title — can be updated dynamically (e.g. "Invoice #489391"). */
  label: string;
};

export type WorkspaceTabsState = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  /** Next tab number to assign (= open tab count + 1). */
  nextTabNumber: number;
};

export type PersistedWorkspaceTabs = WorkspaceTabsState;
