"use client";

import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { CalculatorToggleButton } from "@/components/app-shell/floating-calculator";
import { MemoPadToggleButton } from "@/components/app-shell/floating-memo-pad";
import { Button } from "@/components/ui/button";
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
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b bg-background/90 px-4 backdrop-blur md:px-6">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-14 w-14 shrink-0 rounded-full border-blue-500/70 bg-background shadow-[0_0_0_6px_rgba(37,99,235,0.20)] touch-manipulation"
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
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
        {expanded ? <PanelLeftClose className="h-6 w-6" /> : <PanelLeftOpen className="h-6 w-6" />}
      </Button>

      <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
        <a href="#" className="text-foreground hover:text-primary">Pricing</a>
        <a href="#" className="text-foreground hover:text-primary">Docs</a>
        <a href="/reports" className="text-foreground hover:text-primary">Reports</a>
        <a href="#" className="text-foreground hover:text-primary">Support</a>
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <SearchMenu />

        <CalculatorToggleButton />

        <MemoPadToggleButton />

        <ThemeToggle />

        <Button type="button" variant="ghost" size="icon" aria-label="Notifications" className="relative shrink-0">
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
