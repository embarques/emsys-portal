"use client";

import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";

import { CalculatorToggleButton } from "@/components/app-shell/floating-calculator";
import { LanguageToggle } from "@/components/app-shell/language-toggle";
import { MemoPadToggleButton } from "@/components/app-shell/floating-memo-pad";
import { Button } from "@/components/ui/button";
import { navigationItemMatchesPath } from "@/lib/navigation/nav-utils";
import { useTopbarNavigation } from "@/lib/navigation/use-navigation";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchMenu } from "./search-menu";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { WorkspaceNavLink } from "./workspace-nav-link";

export function Topbar({
  expanded,
  onToggleSidebar,
}: {
  expanded: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const topbarNavigation = useTopbarNavigation();

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b bg-background/90 px-4 backdrop-blur md:px-6">
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

      <nav
        aria-label={t("shell.topbar.workspaceShortcuts")}
        className="hidden items-center gap-7 text-sm font-medium lg:flex"
      >
        {topbarNavigation.map((item) => {
          if (!item.href) return null;

          const active = navigationItemMatchesPath(item, pathname);

          return (
            <WorkspaceNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              className={cn(
                "text-foreground hover:text-primary",
                active && "text-primary",
              )}
            >
              {item.label}
            </WorkspaceNavLink>
          );
        })}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <SearchMenu />

        <CalculatorToggleButton />

        <MemoPadToggleButton />

        <LanguageToggle />

        <ThemeToggle />

        <Button type="button" variant="ghost" size="icon" aria-label={t("shell.topbar.notifications")} className="relative shrink-0">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            5
          </span>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
