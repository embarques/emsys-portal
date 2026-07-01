"use client";

import { useMemo } from "react";

import { navigation, type NavigationGroup, type NavigationItem } from "@/config/navigation";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { Permission } from "@/lib/auth/types/permission";
import { useTranslation } from "@/lib/i18n";

export type TranslatedNavigationItem = NavigationItem & {
  label: string;
};

export type TranslatedNavigationGroup = {
  titleKey: string;
  title: string;
  items: TranslatedNavigationItem[];
};

function canShowNavItem(
  permission: Permission | undefined,
  hasPermission: (name: string, resourceType: string) => boolean,
) {
  if (!permission) return true;
  return hasPermission(permission.name, permission.resourceType);
}

export function useNavigation(): TranslatedNavigationGroup[] {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  return useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          title: t(group.titleKey),
          items: group.items
            .filter((item) => canShowNavItem(item.permission, hasPermission))
            .map((item) => ({
              ...item,
              label: t(item.labelKey),
            }))
            .sort((a, b) => {
              if (a.href === "/") return -1;
              if (b.href === "/") return 1;
              return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
            }),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission, t],
  );
}

export function useFlatNavigation(): TranslatedNavigationItem[] {
  const groups = useNavigation();
  return useMemo(() => groups.flatMap((group) => group.items), [groups]);
}
