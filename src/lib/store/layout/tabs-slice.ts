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

/** Keep tab numbers contiguous (1…n) so the next opened tab is always n + 1. */
function renumberTabs(state: WorkspaceTabsState) {
  state.tabs = state.tabs.map((tab, index) => ({
    ...tab,
    number: index + 1,
  }));
  state.nextTabNumber = state.tabs.length + 1;
}

function normalizePersistedState(state: Partial<WorkspaceTabsState> | null): WorkspaceTabsState {
  const tabs = dedupeTabs(Array.isArray(state?.tabs) ? state.tabs : []);
  const activeTabId =
    state?.activeTabId && tabs.some((tab) => tab.id === state.activeTabId)
      ? state.activeTabId
      : (tabs.at(-1)?.id ?? null);

  const normalized: WorkspaceTabsState = {
    tabs,
    activeTabId,
    nextTabNumber: 1,
  };
  renumberTabs(normalized);
  return normalized;
}

function writePersistedTabs(state: WorkspaceTabsState) {
  if (typeof window === "undefined") return;
  const payload: PersistedWorkspaceTabs = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    nextTabNumber: state.nextTabNumber,
  };
  window.sessionStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(payload));
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistState: WorkspaceTabsState | null = null;

function flushPendingPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingPersistState) {
    writePersistedTabs(pendingPersistState);
    pendingPersistState = null;
  }
}

function persistTabs(state: WorkspaceTabsState, immediate = false) {
  if (typeof window === "undefined") return;

  pendingPersistState = state;

  if (immediate) {
    flushPendingPersist();
    return;
  }

  if (persistTimer) return;

  persistTimer = setTimeout(() => {
    flushPendingPersist();
  }, 250);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPendingPersist);
}

type OpenWorkspaceTabPayload = {
  id: string;
  href: string;
  label: string;
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
      persistTabs(state, true);
    },
    openWorkspaceTab(state, action: PayloadAction<OpenWorkspaceTabPayload>) {
      const existing = state.tabs.find((tab) => tab.id === action.payload.id);
      if (existing) {
        state.activeTabId = existing.id;
        persistTabs(state);
        return;
      }

      const tab: WorkspaceTab = {
        id: action.payload.id,
        href: action.payload.href,
        label: action.payload.label,
        number: state.tabs.length + 1,
      };

      state.tabs.push(tab);
      while (state.tabs.length > MAX_WORKSPACE_TABS) {
        const removed = state.tabs.shift();
        if (removed?.id === state.activeTabId) {
          state.activeTabId = tab.id;
        }
      }

      renumberTabs(state);
      state.activeTabId = tab.id;
      persistTabs(state, true);
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
        state.nextTabNumber = 1;
        persistTabs(state, true);
        return;
      }

      renumberTabs(state);

      if (wasActive) {
        const nextTab = state.tabs[closingIndex] ?? state.tabs[closingIndex - 1] ?? state.tabs[0];
        state.activeTabId = nextTab?.id ?? null;
      }

      persistTabs(state, true);
    },
    closeOtherWorkspaceTabs(state, action: PayloadAction<string>) {
      const keep = state.tabs.find((tab) => tab.id === action.payload);
      if (!keep) return;

      state.tabs = [keep];
      renumberTabs(state);
      state.activeTabId = keep.id;
      persistTabs(state, true);
    },
    closeWorkspaceTabsToRight(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.id === action.payload);
      if (index === -1 || index >= state.tabs.length - 1) return;

      const removedIds = new Set(state.tabs.slice(index + 1).map((tab) => tab.id));
      state.tabs = state.tabs.slice(0, index + 1);

      if (state.activeTabId && removedIds.has(state.activeTabId)) {
        state.activeTabId = action.payload;
      }

      renumberTabs(state);
      persistTabs(state, true);
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

export function findTabByHref(tabs: WorkspaceTab[], href: string): WorkspaceTab | undefined {
  const pathname = href.split("?")[0] ?? href;
  return tabs.find((tab) => tab.href === pathname);
}
