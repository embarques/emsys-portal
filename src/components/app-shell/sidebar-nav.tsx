"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { NavAlertBadge } from "@/components/app-shell/nav-alert-badge";
import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import {
  navigationGroupHasActiveRoute,
  navigationItemMatchesPath,
  isFlatNavigationGroup,
  submenuHasActiveRoute,
} from "@/lib/navigation/nav-utils";
import {
  useNavAlertCount,
  useNavAlertLabel,
  useNavItemsAlertCount,
  useNavItemsAlertLabel,
} from "@/lib/navigation/use-nav-alert-count";
import {
  useNavigationSections,
  useTopNavigation,
  type TranslatedNavigationGroup,
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
  const alertCount = useNavAlertCount(item.href);
  const alertLabel = useNavAlertLabel(item.href, alertCount);

  if (!item.href) return null;

  const active = navigationItemMatchesPath(item, pathname);
  const Icon = item.icon;

  return (
    <WorkspaceNavLink
      href={item.href}
      label={item.label}
      onClick={onNavigate}
      aria-label={alertLabel ? `${item.label}, ${alertLabel}` : item.label}
      className={cn(navRowClassName(active), className)}
    >
      <Icon className={navIconClassName} />
      <span className={navLabelClassName}>{item.label}</span>
      <NavAlertBadge count={alertCount} label={alertLabel} />
    </WorkspaceNavLink>
  );
}

function NavExpandRow({
  label,
  icon: Icon,
  open,
  active,
  onToggle,
  alertCount = 0,
  alertLabel = "",
}: {
  label: string;
  icon?: TranslatedNavigationItem["icon"];
  open: boolean;
  active: boolean;
  onToggle: () => void;
  alertCount?: number;
  alertLabel?: string;
}) {
  const showAlert = !open && alertCount > 0;
  const visibleAlertLabel = showAlert ? alertLabel : "";

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={visibleAlertLabel ? `${label}, ${visibleAlertLabel}` : undefined}
      onClick={onToggle}
      className={navRowClassName(active)}
    >
      {Icon ? <Icon className={navIconClassName} /> : null}
      <span className={navLabelClassName}>{label}</span>
      {showAlert ? <NavAlertBadge count={alertCount} label={visibleAlertLabel} /> : null}
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
  const alertCount = useNavItemsAlertCount(item.children ?? []);
  const alertLabel = useNavItemsAlertLabel(item.children ?? [], alertCount);
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
        alertCount={alertCount}
        alertLabel={alertLabel}
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

function NavSectionDivider() {
  return (
    <div className="px-3 py-4" role="separator" aria-hidden="true">
      <div className="h-px bg-border/80" />
    </div>
  );
}

function NavGroup({
  group,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  group: TranslatedNavigationGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const alertCount = useNavItemsAlertCount(group.items);
  const alertLabel = useNavItemsAlertLabel(group.items, alertCount);

  if (isFlatNavigationGroup(group.items)) {
    const onlyItem = group.items[0];
    return (
      <NavLeafLink
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

  const hasActiveRoute = navigationGroupHasActiveRoute(group.items, pathname);
  const isParentSelected = !open && hasActiveRoute;
  const GroupIcon = group.icon ?? group.items[0]?.icon;

  return (
    <div className="space-y-1">
      <NavExpandRow
        label={group.title}
        icon={GroupIcon}
        open={open}
        active={isParentSelected}
        alertCount={alertCount}
        alertLabel={alertLabel}
        onToggle={onToggle}
      />

      {open ? (
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
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const topNavigation = useTopNavigation();
  const visibleSections = useNavigationSections();
  const visibleGroups = React.useMemo(
    () => visibleSections.flatMap((section) => section.groups),
    [visibleSections],
  );

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    return Object.fromEntries(visibleGroups.map((group, index) => [group.titleKey, index === 0]));
  });

  React.useEffect(() => {
    const activeGroup = visibleGroups.find((group) =>
      navigationGroupHasActiveRoute(group.items, pathname),
    );
    if (!activeGroup) return;

    setOpenGroups((current) => {
      if (current[activeGroup.titleKey]) return current;
      return { ...current, [activeGroup.titleKey]: true };
    });
  }, [pathname, visibleGroups]);

  return (
    <nav className="flex flex-col">
      {topNavigation.length > 0 ? (
        <div className="flex flex-col gap-1">
          {topNavigation.map((item) => (
            <NavLeafLink
              key={item.href ?? item.labelKey}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}

      {visibleSections.map((section, sectionIndex) => (
        <div key={section.id}>
          {sectionIndex > 0 || topNavigation.length > 0 ? <NavSectionDivider /> : null}
          <div className="flex flex-col gap-1">
            {section.groups.map((group) => (
              <NavGroup
                key={group.titleKey}
                group={group}
                pathname={pathname}
                open={openGroups[group.titleKey] ?? false}
                onToggle={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.titleKey]: !current[group.titleKey],
                  }))
                }
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
