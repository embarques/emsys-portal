"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";

import { ConfigurationBootstrap } from "@/components/configuration/configuration-bootstrap";
import { FloatingCalculator } from "@/components/app-shell/floating-calculator";
import { FloatingMemoPad } from "@/components/app-shell/floating-memo-pad";
import { WorkspaceTabBar } from "@/components/app-shell/workspace-tab-bar";
import { WorkspaceTabPanels } from "@/components/app-shell/workspace-tab-panels";
import { WorkspaceTabsSync } from "@/components/app-shell/workspace-tabs-sync";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Topbar } from "./topbar";
import { useIsDesktopWorkspaceTabs } from "@/hooks/use-is-mobile-viewport";
import { useTranslation } from "@/lib/i18n";
import { workspaceContentFrameClassName } from "@/lib/layout/workspace-content-layout";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isDesktopTabs = useIsDesktopWorkspaceTabs();

  useEffect(() => {
    const saved = window.localStorage.getItem("atlas-sidebar-expanded");

    if (saved !== null) {
      setSidebarExpanded(saved === "true");
      return;
    }

    // Desktop starts expanded. Smaller screens start as the icon rail,
    // matching the Pulse UI behavior from the reference screenshots.
    setSidebarExpanded(window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileSidebarOpen(true);
      return;
    }

    setSidebarExpanded((current) => {
      const next = !current;
      window.localStorage.setItem("atlas-sidebar-expanded", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfigurationBootstrap />
      <DesktopSidebar expanded={sidebarExpanded} />
      <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} />

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 max-md:pl-0 md:pl-20",
          sidebarExpanded && "xl:pl-72",
        )}
      >
        <Topbar expanded={sidebarExpanded} onToggleSidebar={toggleSidebar} />
        <main className="min-h-[calc(100vh-5rem)]">
          {isDesktopTabs ? (
            <Suspense
              fallback={
                <div className={`${workspaceContentFrameClassName} text-sm text-muted-foreground`}>
                  {t("shell.dashboard.loadingWorkspace")}
                </div>
              }
            >
              <WorkspaceTabsSync />
              <WorkspaceTabBar />
              <WorkspaceTabPanels />
            </Suspense>
          ) : (
            <div className={workspaceContentFrameClassName}>{children}</div>
          )}
        </main>
      </div>

      <FloatingCalculator />
      <FloatingMemoPad />
    </div>
  );
}
