type OpenFormTabParams = {
  feature: string;
  baseHref: string;
  mode: string;
  entityId?: string;
  label: string;
  journalBatch?: {
    queue: "reconciliation" | "clearance";
    requestId: string;
    ids: string[];
  };
};

type JournalBatchOpenHandler = (params: OpenFormTabParams) => void;

declare global {
  interface Window {
    __openJournalBatchConfirm?: JournalBatchOpenHandler;
    __closeJournalBatchConfirm?: (tabId: string) => void;
  }
}

export function useWorkspaceTabs() {
  return {
    tabs: [],
    activeTabId: null,
    sectionColorOverrides: undefined,
    isDesktopTabs: true,
    openTab: () => undefined,
    openFormTab: (params: OpenFormTabParams) => {
      window.__openJournalBatchConfirm?.(params);
    },
    closeFormTabAndReturn: (tabId: string) => {
      window.__closeJournalBatchConfirm?.(tabId);
    },
    activateTab: () => undefined,
    closeTab: () => undefined,
    closeOtherTabs: () => undefined,
    closeTabsToRight: () => undefined,
    closeAllTabs: () => undefined,
  };
}

export function useUpdateWorkspaceTabLabel() {
  return () => undefined;
}

export function useUpdateWorkspaceTabColor() {
  return () => undefined;
}
