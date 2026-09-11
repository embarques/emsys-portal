"use client";

import { memo } from "react";

import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { useTranslation } from "@/lib/i18n";
import { workspaceContentFrameClassName } from "@/lib/layout/workspace-content-layout";
import { resolveWorkspaceComponent } from "@/lib/layout/workspace-registry";
import { resolveWorkspaceFormComponent } from "@/lib/layout/workspace-form-registry";
import { WorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { cn } from "@/lib/utils";

type WorkspaceTabPanelProps = {
  tab: WorkspaceTab;
  active: boolean;
};

const WorkspaceTabPanel = memo(function WorkspaceTabPanel({ tab, active }: WorkspaceTabPanelProps) {
  const { t } = useTranslation();
  const FormComponent = tab.form ? resolveWorkspaceFormComponent(tab.form.feature) : null;
  const Component = tab.form ? null : resolveWorkspaceComponent(tab.href);

  return (
    <div hidden={!active} aria-hidden={!active} className={active ? "block" : "hidden"}>
      <WorkspaceTabScope tabId={tab.id} isActive={active}>
        {tab.form && FormComponent ? (
          <FormComponent
            tabId={tab.id}
            mode={tab.form.mode}
            entityId={tab.form.entityId}
            customerType={tab.form.customerType}
          />
        ) : Component ? (
          <Component />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            {t("shell.tabs.unregistered")}
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
      <div className={workspaceContentFrameClassName} data-testid="workspace-default-dashboard">
        <DashboardWorkspace />
      </div>
    );
  }

  return (
    <div className={cn("relative", workspaceContentFrameClassName)}>
      {tabs.map((tab) => (
        <WorkspaceTabPanel key={tab.id} tab={tab} active={tab.id === activeTabId} />
      ))}
    </div>
  );
}
