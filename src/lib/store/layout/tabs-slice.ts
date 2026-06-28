import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  MAX_WORKSPACE_TABS,
  WORKSPACE_TABS_STORAGE_KEY,
  type PersistedWorkspaceTabs,
  type WorkspaceTab,
  type WorkspaceTabsState,
} from "@/lib/layout/workspace-tab-types";

const initialState: WorkspaceTabsState = {
  tabs: [],
  activeTabId: null,
};

function dedupeTabs(tabs: WorkspaceTab[]): WorkspaceTab[] {
  const seen = new Set<string>();
  const unique: WorkspaceTab[] = [];

  for (const tab of tabs) {
    if (seen.has(tab.id)) continue;
    seen.add(tab.id);
    unique.push(tab);
  }

  return unique;
}

function persistTabs(state: WorkspaceTabsState) {
  if (typeof window === "undefined") return;
  const payload: PersistedWorkspaceTabs = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
  };
  window.sessionStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(payload));
}

const tabsSlice = createSlice({
  name: "layoutTabs",
  initialState,
  reducers: {
    hydrateWorkspaceTabs(state, action: PayloadAction<WorkspaceTabsState>) {
      const tabs = dedupeTabs(action.payload.tabs);
      const activeTabId =
        action.payload.activeTabId && tabs.some((tab) => tab.id === action.payload.activeTabId)
          ? action.payload.activeTabId
          : (tabs.at(-1)?.id ?? null);

      state.tabs = tabs;
      state.activeTabId = activeTabId;
      persistTabs(state);
    },
    openWorkspaceTab(state, action: PayloadAction<WorkspaceTab>) {
      const existing = state.tabs.find((tab) => tab.id === action.payload.id);
      if (existing) {
        state.activeTabId = action.payload.id;
        persistTabs(state);
        return;
      }

      state.tabs.push(action.payload);
      while (state.tabs.length > MAX_WORKSPACE_TABS) {
        const removed = state.tabs.shift();
        if (removed?.id === state.activeTabId) {
          state.activeTabId = action.payload.id;
        }
      }

      state.activeTabId = action.payload.id;
      persistTabs(state);
    },
    setActiveWorkspaceTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload;
      persistTabs(state);
    },
    updateWorkspaceTabLabel(state, action: PayloadAction<{ id: string; label: string }>) {
      const tab = state.tabs.find((entry) => entry.id === action.payload.id);
      if (!tab) return;
      tab.label = action.payload.label;
      persistTabs(state);
    },
    closeWorkspaceTab(state, action: PayloadAction<string>) {
      const closingId = action.payload;
      const wasActive = state.activeTabId === closingId;
      const closingIndex = state.tabs.findIndex((entry) => entry.id === closingId);

      state.tabs = state.tabs.filter((entry) => entry.id !== closingId);

      if (state.tabs.length === 0) {
        state.activeTabId = null;
        persistTabs(state);
        return;
      }

      if (wasActive) {
        const nextTab = state.tabs[closingIndex] ?? state.tabs[closingIndex - 1] ?? state.tabs[0];
        state.activeTabId = nextTab?.id ?? null;
      }

      persistTabs(state);
    },
    closeOtherWorkspaceTabs(state, action: PayloadAction<string>) {
      const keep = state.tabs.find((tab) => tab.id === action.payload);
      if (!keep) return;

      state.tabs = [keep];
      state.activeTabId = keep.id;
      persistTabs(state);
    },
    closeWorkspaceTabsToRight(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.id === action.payload);
      if (index === -1 || index >= state.tabs.length - 1) return;

      const removedIds = new Set(state.tabs.slice(index + 1).map((tab) => tab.id));
      state.tabs = state.tabs.slice(0, index + 1);

      if (state.activeTabId && removedIds.has(state.activeTabId)) {
        state.activeTabId = action.payload;
      }

      persistTabs(state);
    },
    resetWorkspaceTabs(state) {
      state.tabs = [];
      state.activeTabId = null;
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(WORKSPACE_TABS_STORAGE_KEY);
      }
    },
  },
});

export const {
  hydrateWorkspaceTabs,
  openWorkspaceTab,
  setActiveWorkspaceTab,
  updateWorkspaceTabLabel,
  closeWorkspaceTab,
  closeOtherWorkspaceTabs,
  closeWorkspaceTabsToRight,
  resetWorkspaceTabs,
} = tabsSlice.actions;

export default tabsSlice.reducer;

export function readPersistedWorkspaceTabs(): WorkspaceTabsState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkspaceTabs;
    if (!Array.isArray(parsed.tabs)) return null;
    return {
      tabs: dedupeTabs(parsed.tabs),
      activeTabId: parsed.activeTabId,
    };
  } catch {
    return null;
  }
}
