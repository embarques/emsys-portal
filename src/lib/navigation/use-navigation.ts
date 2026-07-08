"use client";

import { useMemo } from "react";

import {
  navigation,
  topbarNavigationItems,
  topNavigationItems,
  type NavigationItem,
} from "@/config/navigation";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { Permission } from "@/lib/auth/types/permission";
import { useTranslation } from "@/lib/i18n";

export type TranslatedNavigationItem = Omit<NavigationItem, "children"> & {
  label: string;
  children?: TranslatedNavigationItem[];
};

export type TranslatedNavigationGroup = {
  titleKey: string;
  title: string;
  icon?: NavigationItem["icon"];
  items: TranslatedNavigationItem[];
};

function canShowNavItem(
  permission: Permission | undefined,
  hasPermission: (name: string, resourceType: string) => boolean,
) {
  if (!permission) return true;
  return hasPermission(permission.name, permission.resourceType);
}

function translateNavItems(
  items: NavigationItem[],
  t: (key: string) => string,
  hasPermission: (name: string, resourceType: string) => boolean,
): TranslatedNavigationItem[] {
  return items
    .map((item) => {
      const children = item.children
        ? translateNavItems(item.children, t, hasPermission)
        : undefined;

      if (children && children.length === 0) {
        return null;
      }

      const visible =
        item.children?.length
          ? Boolean(children?.length)
          : canShowNavItem(item.permission, hasPermission);

      if (!visible) return null;

      return {
        ...item,
        label: t(item.labelKey),
        children,
      } as TranslatedNavigationItem;
    })
    .filter((item): item is TranslatedNavigationItem => item != null);
}

function sortTranslatedNavItems(
  items: TranslatedNavigationItem[],
  locale: string,
): TranslatedNavigationItem[] {
  return [...items]
    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }))
    .map((item) => ({
      ...item,
      children: item.children ? sortTranslatedNavItems(item.children, locale) : undefined,
    }));
}

function translateAndSortNavItems(
  items: NavigationItem[],
  t: (key: string) => string,
  hasPermission: (name: string, resourceType: string) => boolean,
  locale: string,
): TranslatedNavigationItem[] {
  return sortTranslatedNavItems(translateNavItems(items, t, hasPermission), locale);
}

export function useTopNavigation(): TranslatedNavigationItem[] {
  const { locale, t } = useTranslation();
  const { hasPermission } = useAuth();

  return useMemo(
    () => translateAndSortNavItems(topNavigationItems, t, hasPermission, locale),
    [hasPermission, locale, t],
  );
}

export function useTopbarNavigation(): TranslatedNavigationItem[] {
  const { locale, t } = useTranslation();
  const { hasPermission } = useAuth();

  return useMemo(
    () => translateAndSortNavItems(topbarNavigationItems, t, hasPermission, locale),
    [hasPermission, locale, t],
  );
}

export function useNavigation(): TranslatedNavigationGroup[] {
  const { locale, t } = useTranslation();
  const { hasPermission } = useAuth();

  return useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          title: t(group.titleKey),
          items: translateAndSortNavItems(group.items, t, hasPermission, locale),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission, locale, t],
  );
}

export function useFlatNavigation(): TranslatedNavigationItem[] {
  const topItems = useTopNavigation();
  const groups = useNavigation();
  return useMemo(() => {
    function flattenTranslated(items: TranslatedNavigationItem[]): TranslatedNavigationItem[] {
      return items.flatMap((item) => {
        if (item.children?.length) {
          return flattenTranslated(item.children);
        }
        return item.href ? [item] : [];
      });
    }

    return [...topItems, ...flattenTranslated(groups.flatMap((group) => group.items))];
  }, [groups, topItems]);
}
