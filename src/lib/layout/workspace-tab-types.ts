import type { WorkspaceTabSection } from "@/lib/layout/workspace-tab-colors";

export type { WorkspaceTabSection };

export const WORKSPACE_TAB_PARAM = "tab";

export const WORKSPACE_TABS_STORAGE_KEY = "emsys-workspace-tabs";

/** Show the tab overflow menu when at least this many tabs are open. */
export const WORKSPACE_TAB_OVERFLOW_THRESHOLD = 6;

/** Add/edit form context carried by a form tab (vs. a regular list/workspace tab). */
export type WorkspaceTabForm = {
  /** Feature key resolved against the form host registry (e.g. "customers"). */
  feature: string;
  mode: "add" | "edit" | "stage";
  /** Target record id when editing. */
  entityId?: string;
  /** Tab to re-activate after the form tab closes (the tab that opened it). */
  returnToTabId?: string | null;
  /**
   * Preset customer type (sender/receiver) locked in the customers add form when
   * the tab is opened from the order form's "New" party actions.
   */
  customerType?: number;
};

export type WorkspaceTab = {
  /** Internal stable key for React / keep-alive. */
  id: string;
  /** Sequential tab number shown in the URL and tab bar (1…n, renumbered when tabs close). */
  number: number;
  href: string;
  /** Display title — can be updated dynamically (e.g. "Invoice #489391"). */
  label: string;
  /** Optional user-chosen accent color (hex, e.g. `#3b82f6`). */
  color?: string | null;
  /** Present when this tab hosts an add/edit form instead of a workspace page. */
  form?: WorkspaceTabForm;
};

export type WorkspaceTabsState = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  /** Next tab number to assign (= open tab count + 1). */
  nextTabNumber: number;
  /** User overrides for default section accent colors (session-persisted). */
  sectionColorOverrides?: Partial<Record<WorkspaceTabSection, string>>;
};

export type PersistedWorkspaceTabs = WorkspaceTabsState;
