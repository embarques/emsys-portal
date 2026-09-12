"use client";

import { memo, useState } from "react";

import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { useTranslation } from "@/lib/i18n";
import {
  workspaceContentFrameClassName,
  workspaceContentPaddingClassName,
  workspaceContentShellClassName,
} from "@/lib/layout/workspace-content-layout";
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
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const FormComponent = tab.form ? resolveWorkspaceFormComponent(tab.form.feature) : null;
  const Component = tab.form ? null : resolveWorkspaceComponent(tab.href);

  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      className={cn("relative", active ? "block" : "hidden")}
    >
      <WorkspaceTabScope tabId={tab.id} isActive={active} portalContainer={portalContainer}>
        <div className={workspaceContentPaddingClassName}>
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
        </div>
        {/*
          Portal host for Dialog/Sheet overlays. Stays empty until a modal opens.
          Absolute inset covers the full tab panel (including padding) so dimming
          does not leave an undimmed frame around the content.
        */}
        <div
          ref={setPortalContainer}
          data-workspace-tab-portal=""
          className="pointer-events-none absolute inset-0 z-50 [&:not(:empty)]:pointer-events-auto"
        />
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
    <div className={cn("relative", workspaceContentShellClassName)}>
      {tabs.map((tab) => (
        <WorkspaceTabPanel key={tab.id} tab={tab} active={tab.id === activeTabId} />
      ))}
    </div>
  );
}
