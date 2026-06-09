"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { navigation } from "@/config/navigation";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { Permission } from "@/lib/auth/types/permission";
import { cn } from "@/lib/utils";

function groupHasActiveRoute(
  group: (typeof navigation)[number],
  pathname: string,
  visibleItems: (typeof navigation)[number]["items"],
) {
  return visibleItems.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}

function canShowNavItem(
  permission: Permission | undefined,
  hasPermission: (name: string, resourceType: string) => boolean,
) {
  if (!permission) return true;
  return hasPermission(permission.name, permission.resourceType);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const visibleNavigation = React.useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canShowNavItem(item.permission, hasPermission)),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission],
  );

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    return Object.fromEntries(visibleNavigation.map((group, index) => [group.title, index === 0]));
  });

  React.useEffect(() => {
    const activeGroup = visibleNavigation.find((group) =>
      groupHasActiveRoute(group, pathname, group.items),
    );
    if (!activeGroup) return;

    setOpenGroups((current) => ({ ...current, [activeGroup.title]: true }));
  }, [pathname, visibleNavigation]);

  return (
    <nav className="space-y-1">
      {visibleNavigation.map((group) => {
        const isOpen = openGroups[group.title] ?? false;
        const hasActiveRoute = groupHasActiveRoute(group, pathname, group.items);
        const GroupIcon = group.items[0]?.icon;

        return (
          <div key={group.title} className="rounded-xl">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenGroups((current) => ({ ...current, [group.title]: !isOpen }))}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition",
                hasActiveRoute ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              {GroupIcon ? <GroupIcon className="h-5 w-5 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate">{group.title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {isOpen ? (
              <div className="mt-1 space-y-1 pl-11 pr-2">
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center rounded-xl px-3 py-2 text-sm transition",
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
