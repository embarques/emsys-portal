"use client";

import { usePathname } from "next/navigation";

import { SidebarBrand } from "@/components/brand/sidebar-brand";
import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import { useFlatNavigation } from "@/lib/navigation/use-navigation";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { SidebarProfileMenu } from "./sidebar-profile-menu";

const sidebarShellClassName =
  "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card text-card-foreground shadow-lg";

const sidebarSectionClassName = "border-border";

const sidebarBrandHeaderClassName =
  "flex shrink-0 items-center overflow-visible border-b px-5 py-3.5";

const sidebarBrandHeaderCompactClassName = cn(
  sidebarBrandHeaderClassName,
  "justify-center px-0",
);

const iconNavLinkClassName =
  "flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground";

const iconNavLinkActiveClassName = "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

type DesktopSidebarProps = {
  expanded: boolean;
};

export function DesktopSidebar({ expanded }: DesktopSidebarProps) {
  const pathname = usePathname();
  const flatNavigation = useFlatNavigation();

  if (!expanded) {
    return (
      <aside className={cn(sidebarShellClassName, "hidden w-20 md:flex")}>
        <div className={cn(sidebarBrandHeaderCompactClassName, sidebarSectionClassName)}>
          <SidebarBrand compact priority />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4">
          {flatNavigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <WorkspaceNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                title={item.label}
                className={cn(iconNavLinkClassName, active && iconNavLinkActiveClassName)}
              >
                <Icon className="h-6 w-6" />
              </WorkspaceNavLink>
            );
          })}
        </nav>

        <div className={cn("relative flex shrink-0 justify-center border-t p-3", sidebarSectionClassName)}>
          <SidebarProfileMenu compact />
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn(sidebarShellClassName, "hidden w-20 md:flex xl:w-72")}>
      <div className={cn(sidebarBrandHeaderCompactClassName, "xl:hidden", sidebarSectionClassName)}>
        <SidebarBrand compact priority />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-4 xl:hidden">
        {flatNavigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <WorkspaceNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              title={item.label}
              className={cn(iconNavLinkClassName, active && iconNavLinkActiveClassName)}
            >
              <Icon className="h-6 w-6" />
            </WorkspaceNavLink>
          );
        })}
      </nav>

      <div className={cn("relative flex shrink-0 justify-center border-t p-3 xl:hidden", sidebarSectionClassName)}>
        <SidebarProfileMenu compact />
      </div>

      <div className={cn("hidden xl:flex", sidebarBrandHeaderClassName, sidebarSectionClassName)}>
        <SidebarBrand priority />
      </div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto p-3 xl:block">
        <SidebarNav />
      </div>

      <div className={cn("relative hidden shrink-0 border-t p-3 xl:block", sidebarSectionClassName)}>
        <SidebarProfileMenu />
      </div>
    </aside>
  );
}
