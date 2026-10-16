import type { WorkspaceTabForm } from "@/lib/layout/workspace-tab-types";
export function useWorkspaceTabs() {
  return {
    isDesktopTabs: !(window as unknown as { mobileDocs?: boolean }).mobileDocs,
    openFormTab: (options: WorkspaceTabForm) => {
      const state = window as unknown as { documentTabs?: WorkspaceTabForm[] };
      state.documentTabs ??= [];
      state.documentTabs.push(options);
    },
  };
}
