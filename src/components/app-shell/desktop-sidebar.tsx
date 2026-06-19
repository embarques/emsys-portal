"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";

import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

const flatNavigation = navigation.flatMap((group) => group.items);

const sidebarShellClassName =
  "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card text-card-foreground shadow-lg";

const sidebarSectionClassName = "border-border";

const iconNavLinkClassName =
  "flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground";

const iconNavLinkActiveClassName = "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

type DesktopSidebarProps = {
  expanded: boolean;
};

export function DesktopSidebar({ expanded }: DesktopSidebarProps) {
  const pathname = usePathname();

  if (!expanded) {
    return (
      <aside className={cn(sidebarShellClassName, "w-20")}>
        <div className={cn("flex h-20 shrink-0 items-center justify-center border-b", sidebarSectionClassName)}>
          <Link
            href="/"
            aria-label="Dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Boxes className="h-6 w-6" />
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4">
          {flatNavigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(iconNavLinkClassName, active && iconNavLinkActiveClassName)}
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          })}
        </nav>

        <div className={cn("shrink-0 border-t p-3", sidebarSectionClassName)}>
          <Link
            href="/settings"
            title="Profile"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 transition hover:bg-muted"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
              HJ
            </div>
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn(sidebarShellClassName, "w-20 xl:w-72")}>
      <div className={cn("flex h-20 shrink-0 items-center justify-center border-b xl:hidden", sidebarSectionClassName)}>
        <Link
          href="/"
          aria-label="Dashboard"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Boxes className="h-6 w-6" />
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4 xl:hidden">
        {flatNavigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(iconNavLinkClassName, active && iconNavLinkActiveClassName)}
            >
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
      </nav>

      <div className={cn("shrink-0 border-t p-3 xl:hidden", sidebarSectionClassName)}>
        <Link
          href="/settings"
          title="Profile"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 transition hover:bg-muted"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
            HJ
          </div>
        </Link>
      </div>

      <div className={cn("hidden h-20 shrink-0 items-center gap-3 border-b px-5 xl:flex", sidebarSectionClassName)}>
        <Link
          href="/"
          aria-label="Dashboard"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Boxes className="h-6 w-6" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none text-foreground">{siteConfig.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{siteConfig.company}</p>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto p-3 xl:block">
        <SidebarNav />
      </div>

      <div className={cn("hidden shrink-0 border-t p-3 xl:block", sidebarSectionClassName)}>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 transition hover:bg-muted"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
            HJ
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">Hector Mejia</p>
            <p className="truncate text-xs text-muted-foreground">Administrator</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
