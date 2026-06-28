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
  nextTabNumber: 1,
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

function normalizePersistedState(state: Partial<WorkspaceTabsState> | null): WorkspaceTabsState {
  const rawTabs = Array.isArray(state?.tabs) ? state.tabs : [];
  let nextTabNumber = typeof state?.nextTabNumber === "number" && state.nextTabNumber > 0 ? state.nextTabNumber : 1;

  const tabs = dedupeTabs(
    rawTabs.map((tab) => {
      if (typeof tab.number === "number" && tab.number > 0) {
        nextTabNumber = Math.max(nextTabNumber, tab.number + 1);
        return tab;
      }

      const number = nextTabNumber;
      nextTabNumber += 1;
      return { ...tab, number };
    }),
  );

  const activeTabId =
    state?.activeTabId && tabs.some((tab) => tab.id === state.activeTabId)
      ? state.activeTabId
      : (tabs.at(-1)?.id ?? null);

  return { tabs, activeTabId, nextTabNumber };
}

function persistTabs(state: WorkspaceTabsState) {
  if (typeof window === "undefined") return;
  const payload: PersistedWorkspaceTabs = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    nextTabNumber: state.nextTabNumber,
  };
  window.sessionStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(payload));
}

function allocateTabNumber(state: WorkspaceTabsState, preferred?: number): number {
  if (preferred != null && preferred > 0 && !state.tabs.some((tab) => tab.number === preferred)) {
    state.nextTabNumber = Math.max(state.nextTabNumber, preferred + 1);
    return preferred;
  }

  const number = state.nextTabNumber;
  state.nextTabNumber += 1;
  return number;
}

type OpenWorkspaceTabPayload = {
  id: string;
  href: string;
  label: string;
  number?: number;
};

const tabsSlice = createSlice({
  name: "layoutTabs",
  initialState,
  reducers: {
    hydrateWorkspaceTabs(state, action: PayloadAction<Partial<WorkspaceTabsState>>) {
      const normalized = normalizePersistedState(action.payload);
      state.tabs = normalized.tabs;
      state.activeTabId = normalized.activeTabId;
      state.nextTabNumber = normalized.nextTabNumber;
      persistTabs(state);
    },
    openWorkspaceTab(state, action: PayloadAction<OpenWorkspaceTabPayload>) {
      const existing = state.tabs.find((tab) => tab.id === action.payload.id);
      if (existing) {
        state.activeTabId = existing.id;
        persistTabs(state);
        return;
      }

      const number = allocateTabNumber(state, action.payload.number);
      const tab: WorkspaceTab = {
        id: action.payload.id,
        href: action.payload.href,
        label: action.payload.label,
        number,
      };

      state.tabs.push(tab);
      while (state.tabs.length > MAX_WORKSPACE_TABS) {
        const removed = state.tabs.shift();
        if (removed?.id === state.activeTabId) {
          state.activeTabId = tab.id;
        }
      }

      state.activeTabId = tab.id;
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
      state.nextTabNumber = 1;
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
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceTabs>;
    return normalizePersistedState(parsed);
  } catch {
    return null;
  }
}

export function findTabByNumber(tabs: WorkspaceTab[], tabNumber: number): WorkspaceTab | undefined {
  return tabs.find((tab) => tab.number === tabNumber);
}
