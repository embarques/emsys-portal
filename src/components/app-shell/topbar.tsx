"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { CalculatorToggleButton } from "@/components/app-shell/floating-calculator";
import { LanguageToggle } from "@/components/app-shell/language-toggle";
import { MemoPadToggleButton } from "@/components/app-shell/floating-memo-pad";
import { NotificationsMenu } from "@/components/app-shell/notifications-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  workspaceContentHorizontalPaddingClassName,
  workspaceContentShellClassName,
} from "@/lib/layout/workspace-content-layout";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchMenu } from "./search-menu";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar({
  expanded,
  onToggleSidebar,
}: {
  expanded: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div
        className={cn(
          workspaceContentShellClassName,
          workspaceContentHorizontalPaddingClassName,
          "flex h-20 items-center gap-4",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-14 shrink-0 rounded-full border-blue-500/70 bg-background shadow-[0_0_0_6px_rgba(37,99,235,0.20)] touch-manipulation"
          aria-label={expanded ? t("shell.topbar.collapseSidebar") : t("shell.topbar.openSidebarMenu")}
          onClick={onToggleSidebar}
          onTouchStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSidebar();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <PanelLeftOpen className="h-6 w-6 md:hidden" />
          {expanded ? (
            <PanelLeftClose className="hidden h-6 w-6 md:block" />
          ) : (
            <PanelLeftOpen className="hidden h-6 w-6 md:block" />
          )}
        </Button>

        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <TooltipProvider delayDuration={300}>
            <SearchMenu />

            <CalculatorToggleButton />

            <MemoPadToggleButton />

            <LanguageToggle />

            <ThemeToggle />

            <NotificationsMenu />

            <UserMenu />
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
