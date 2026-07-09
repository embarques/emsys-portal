"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import {
  navigationGroupHasActiveRoute,
  navigationItemMatchesPath,
  isFlatNavigationGroup,
  submenuHasActiveRoute,
} from "@/lib/navigation/nav-utils";
import {
  useNavigation,
  useTopNavigation,
  type TranslatedNavigationItem,
} from "@/lib/navigation/use-navigation";
import { cn } from "@/lib/utils";

const navRowBaseClassName =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition";

const navRowInactiveClassName =
  "text-muted-foreground hover:bg-accent hover:text-accent-foreground";

const navRowActiveClassName = "bg-primary/10 font-medium text-primary";

const navIconClassName = "h-4 w-4 shrink-0";

const navLabelClassName = "min-w-0 flex-1 truncate";

const navChevronClassName = "h-4 w-4 shrink-0 text-muted-foreground";

const navNestedClassName = "ml-4 space-y-1 border-l border-border pl-3";

function navRowClassName(active: boolean) {
  return cn(navRowBaseClassName, active ? navRowActiveClassName : navRowInactiveClassName);
}

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
      className={cn(navRowClassName(active), className)}
    >
      <Icon className={navIconClassName} />
      <span className={navLabelClassName}>{item.label}</span>
    </WorkspaceNavLink>
  );
}

function NavExpandRow({
  label,
  icon: Icon,
  open,
  active,
  onToggle,
}: {
  label: string;
  icon?: TranslatedNavigationItem["icon"];
  open: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={navRowClassName(active)}
    >
      {Icon ? <Icon className={navIconClassName} /> : null}
      <span className={navLabelClassName}>{label}</span>
      {open ? (
        <ChevronDown className={navChevronClassName} />
      ) : (
        <ChevronRight className={navChevronClassName} />
      )}
    </button>
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
  const hasActiveChild = submenuHasActiveRoute(item, pathname);
  const [open, setOpen] = React.useState(hasActiveChild);

  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  if (!item.children?.length) return null;

  if (item.children.length === 1) {
    const [onlyChild] = item.children;
    return (
      <NavLeafLink
        item={{
          ...onlyChild,
          label: item.label,
          labelKey: item.labelKey,
          icon: item.icon,
        }}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-1">
      <NavExpandRow
        label={item.label}
        icon={item.icon}
        open={open}
        active={hasActiveChild && !open}
        onToggle={() => setOpen((current) => !current)}
      />

      {open ? (
        <div className={navNestedClassName}>
          {item.children.map((child) => (
            <NavLeafLink
              key={child.href ?? child.labelKey}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
            />
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
        if (isFlatNavigationGroup(group.items)) {
          const onlyItem = group.items[0];
          return (
            <NavLeafLink
              key={group.titleKey}
              item={{
                ...onlyItem,
                label: group.title,
                labelKey: group.titleKey,
                icon: group.icon ?? onlyItem.icon,
                children: undefined,
              }}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          );
        }

        const isOpen = openGroups[group.titleKey] ?? false;
        const hasActiveRoute = navigationGroupHasActiveRoute(group.items, pathname);
        const isParentSelected = !isOpen && hasActiveRoute;
        const GroupIcon = group.icon ?? group.items[0]?.icon;

        return (
          <div key={group.titleKey} className="space-y-1">
            <NavExpandRow
              label={group.title}
              icon={GroupIcon}
              open={isOpen}
              active={isParentSelected}
              onToggle={() =>
                setOpenGroups((current) => ({ ...current, [group.titleKey]: !isOpen }))
              }
            />

            {isOpen ? (
              <div className={navNestedClassName}>
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
