import { createSlice, current, type PayloadAction } from "@reduxjs/toolkit";

import {
  WORKSPACE_TABS_STORAGE_KEY,
  type PersistedWorkspaceTabs,
  type WorkspaceTab,
  type WorkspaceTabForm,
  type WorkspaceTabsState,
} from "@/lib/layout/workspace-tab-types";
import { getMaxWorkspaceTabs } from "@/lib/layout/workspace-tab-limits";
import { normalizeWorkspaceTabColor } from "@/lib/layout/workspace-tab-colors";

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
  const tabs = dedupeTabs(Array.isArray(state?.tabs) ? state.tabs : []).map((tab) => ({
    ...tab,
    color: normalizeWorkspaceTabColor(tab.color),
  }));
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

function serializeTabsState(state: WorkspaceTabsState): string {
  const plain = current(state);
  const payload: PersistedWorkspaceTabs = {
    tabs: plain.tabs.map((tab) => ({ ...tab })),
    activeTabId: plain.activeTabId,
    nextTabNumber: plain.nextTabNumber,
  };
  return JSON.stringify(payload);
}

function writePersistedTabs(serialized: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, serialized);
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistPayload: string | null = null;

function flushPendingPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingPersistPayload) {
    writePersistedTabs(pendingPersistPayload);
    pendingPersistPayload = null;
  }
}

function persistTabs(state: WorkspaceTabsState, immediate = false) {
  if (typeof window === "undefined") return;

  // Serialize synchronously inside the reducer — Immer drafts are revoked after it returns.
  pendingPersistPayload = serializeTabsState(state);

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

function trimTabsToLimit(state: WorkspaceTabsState) {
  const maxTabs = getMaxWorkspaceTabs();

  while (state.tabs.length > maxTabs) {
    const removed = state.tabs.shift();
    if (removed?.id === state.activeTabId) {
      state.activeTabId = state.tabs[0]?.id ?? state.tabs.at(-1)?.id ?? null;
    }
  }

  if (state.tabs.length === 0) {
    state.activeTabId = null;
    state.nextTabNumber = 1;
    return;
  }

  renumberTabs(state);
}

type OpenWorkspaceTabPayload = {
  id: string;
  href: string;
  label: string;
  /** Present when opening an add/edit form tab. */
  form?: WorkspaceTabForm;
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
      trimTabsToLimit(state);
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
        ...(action.payload.form ? { form: action.payload.form } : {}),
      };

      state.tabs.push(tab);
      state.activeTabId = tab.id;
      trimTabsToLimit(state);
      state.activeTabId = tab.id;
      persistTabs(state, true);
    },
    setActiveWorkspaceTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload;
      persistTabs(state);
    },
    updateWorkspaceTabLabel(state, action: PayloadAction<{ id: string; label: string }>) {
      const tab = state.tabs.find((entry) => entry.id === action.payload.id);
      if (!tab || tab.label === action.payload.label) return;
      tab.label = action.payload.label;
      persistTabs(state);
    },
    updateWorkspaceTabColor(state, action: PayloadAction<{ id: string; color: string | null }>) {
      const tab = state.tabs.find((entry) => entry.id === action.payload.id);
      if (!tab) return;
      tab.color = normalizeWorkspaceTabColor(action.payload.color);
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
    enforceWorkspaceTabLimit(state) {
      trimTabsToLimit(state);
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
  updateWorkspaceTabColor,
  closeWorkspaceTab,
  closeOtherWorkspaceTabs,
  closeWorkspaceTabsToRight,
  enforceWorkspaceTabLimit,
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
  // Only match regular workspace tabs so sidebar navigation never lands on a form tab.
  return tabs.find((tab) => !tab.form && tab.href === pathname);
}

export function findFormTab(
  tabs: WorkspaceTab[],
  feature: string,
  mode: WorkspaceTabForm["mode"],
  entityId?: string,
): WorkspaceTab | undefined {
  return tabs.find(
    (tab) =>
      tab.form?.feature === feature &&
      tab.form.mode === mode &&
      (mode === "add"
        ? !entityId || tab.form.entityId === entityId
        : tab.form.entityId === entityId),
  );
}
