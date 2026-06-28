"use client";

import { resolveWorkspaceComponent } from "@/lib/layout/workspace-registry";
import { WorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

export function WorkspaceTabPanels() {
  const { tabs, activeTabId } = useWorkspaceTabs();

  if (tabs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
        <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          Select a page from the sidebar to open a workspace tab.
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
      {tabs.map((tab) => {
        const Component = resolveWorkspaceComponent(tab.href);
        const active = tab.id === activeTabId;

        return (
          <div key={tab.id} hidden={!active} aria-hidden={!active} className={active ? "block" : "hidden"}>
            <WorkspaceTabScope tabId={tab.id}>
              {Component ? <Component /> : (
                <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                  This workspace is not registered yet.
                </div>
              )}
            </WorkspaceTabScope>
          </div>
        );
      })}
    </div>
  );
}
