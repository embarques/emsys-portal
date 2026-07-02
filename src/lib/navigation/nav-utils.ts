import type { NavigationGroup, NavigationItem } from "@/config/navigation";

/** Leaf nav entries that link to a page (excludes submenu headers). */
export function flattenNavigationItems(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return flattenNavigationItems(item.children);
    }
    return item.href ? [item] : [];
  });
}

export function flattenNavigationGroups(groups: NavigationGroup[]): NavigationItem[] {
  return groups.flatMap((group) => flattenNavigationItems(group.items));
}

export function flattenAllNavigationItems(
  groups: NavigationGroup[],
  topItems: NavigationItem[] = [],
): NavigationItem[] {
  return [...topItems, ...flattenNavigationGroups(groups)];
}

export function findNavigationItemByHref(
  items: NavigationItem[],
  pathname: string,
): NavigationItem | null {
  for (const item of items) {
    if (item.href === pathname) return item;
    if (item.children?.length) {
      const nested = findNavigationItemByHref(item.children, pathname);
      if (nested) return nested;
    }
  }
  return null;
}

export function navigationItemMatchesPath(item: NavigationItem, pathname: string): boolean {
  if (!item.href) return false;
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

export function navigationGroupHasActiveRoute(
  items: NavigationItem[],
  pathname: string,
): boolean {
  return flattenNavigationItems(items).some((item) => navigationItemMatchesPath(item, pathname));
}

export function submenuHasActiveRoute(item: NavigationItem, pathname: string): boolean {
  if (!item.children?.length) return false;
  return item.children.some((child) => navigationItemMatchesPath(child, pathname));
}
