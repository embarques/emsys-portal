"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import {
  navigationGroupHasActiveRoute,
  navigationItemMatchesPath,
  submenuHasActiveRoute,
} from "@/lib/navigation/nav-utils";
import {
  useNavigation,
  useTopNavigation,
  type TranslatedNavigationItem,
} from "@/lib/navigation/use-navigation";
import { cn } from "@/lib/utils";

function NavLeafLink({
  item,
  pathname,
  onNavigate,
  className,
}: {
  item: TranslatedNavigationItem;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  if (!item.href) return null;

  const active = navigationItemMatchesPath(item, pathname);
  const Icon = item.icon;

  return (
    <WorkspaceNavLink
      href={item.href}
      label={item.label}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </WorkspaceNavLink>
  );
}

function NavSubmenu({
  item,
  pathname,
  onNavigate,
}: {
  item: TranslatedNavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const submenuKey = item.labelKey;
  const hasActiveChild = submenuHasActiveRoute(item, pathname);
  const [open, setOpen] = React.useState(hasActiveChild);
  const Icon = item.icon;

  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  if (!item.children?.length) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition",
          hasActiveChild && !open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="ml-4 space-y-1 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLeafLink key={child.href ?? child.labelKey} item={child} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const topNavigation = useTopNavigation();
  const visibleNavigation = useNavigation();

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    return Object.fromEntries(visibleNavigation.map((group, index) => [group.titleKey, index === 0]));
  });

  React.useEffect(() => {
    const activeGroup = visibleNavigation.find((group) =>
      navigationGroupHasActiveRoute(group.items, pathname),
    );
    if (!activeGroup) return;

    setOpenGroups((current) => {
      if (current[activeGroup.titleKey]) return current;
      return { ...current, [activeGroup.titleKey]: true };
    });
  }, [pathname, visibleNavigation]);

  return (
    <nav className="space-y-1">
      {topNavigation.map((item) => (
        <NavLeafLink
          key={item.href ?? item.labelKey}
          item={item}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}

      {topNavigation.length > 0 && visibleNavigation.length > 0 ? <div className="my-2" /> : null}

      {visibleNavigation.map((group) => {
        const isOpen = openGroups[group.titleKey] ?? false;
        const hasActiveRoute = navigationGroupHasActiveRoute(group.items, pathname);
        const isParentSelected = !isOpen && hasActiveRoute;
        const GroupIcon = group.icon ?? group.items[0]?.icon;

        return (
          <div key={group.titleKey} className="rounded-xl">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-current={isParentSelected ? "true" : undefined}
              onClick={() => setOpenGroups((current) => ({ ...current, [group.titleKey]: !isOpen }))}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition",
                isParentSelected
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {GroupIcon ? <GroupIcon className="h-5 w-5 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate">{group.title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {isOpen ? (
              <div className="mt-1 ml-4 space-y-1 pl-3">
                {group.items.map((item) =>
                  item.children?.length ? (
                    <NavSubmenu
                      key={item.labelKey}
                      item={item}
                      pathname={pathname}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <NavLeafLink
                      key={item.href ?? item.labelKey}
                      item={item}
                      pathname={pathname}
                      onNavigate={onNavigate}
                    />
                  ),
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
