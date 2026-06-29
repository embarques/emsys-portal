"use client";

import { memo } from "react";

import { resolveWorkspaceComponent } from "@/lib/layout/workspace-registry";
import { resolveWorkspaceFormComponent } from "@/lib/layout/workspace-form-registry";
import { WorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";

type WorkspaceTabPanelProps = {
  tab: WorkspaceTab;
  active: boolean;
};

const WorkspaceTabPanel = memo(function WorkspaceTabPanel({ tab, active }: WorkspaceTabPanelProps) {
  const FormComponent = tab.form ? resolveWorkspaceFormComponent(tab.form.feature) : null;
  const Component = tab.form ? null : resolveWorkspaceComponent(tab.href);

  return (
    <div hidden={!active} aria-hidden={!active} className={active ? "block" : "hidden"}>
      <WorkspaceTabScope tabId={tab.id} isActive={active}>
        {tab.form && FormComponent ? (
          <FormComponent tabId={tab.id} mode={tab.form.mode} entityId={tab.form.entityId} />
        ) : Component ? (
          <Component />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            This workspace is not registered yet.
          </div>
        )}
      </WorkspaceTabScope>
    </div>
  );
});

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
      {tabs.map((tab) => (
        <WorkspaceTabPanel key={tab.id} tab={tab} active={tab.id === activeTabId} />
      ))}
    </div>
  );
}
