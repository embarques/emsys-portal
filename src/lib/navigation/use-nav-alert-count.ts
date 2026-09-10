"use client";

import { useOutstandingChecksCount } from "@/lib/accounting/checks/use-checks-store";
import { useTranslation } from "@/lib/i18n";

const CHECKS_HREF = "/accounting/checks";

type NavAlertItem = { href?: string; children?: Array<{ href?: string }> };

function alertCountForHref(href: string | undefined, outstandingChecks: number) {
  return href === CHECKS_HREF ? outstandingChecks : 0;
}

function itemTreeHasHref(items: NavAlertItem[], href: string): boolean {
  return items.some((item) => item.href === href || item.children?.some((child) => child.href === href));
}

export function useNavAlertCount(href?: string) {
  const outstandingChecks = useOutstandingChecksCount();
  return alertCountForHref(href, outstandingChecks);
}

export function useNavItemsAlertCount(items: NavAlertItem[]) {
  const outstandingChecks = useOutstandingChecksCount();

  return items.reduce((total, item) => {
    return (
      total +
      alertCountForHref(item.href, outstandingChecks) +
      (item.children?.reduce(
        (nestedTotal, child) => nestedTotal + alertCountForHref(child.href, outstandingChecks),
        0,
      ) ?? 0)
    );
  }, 0);
}

export function useNavAlertLabel(href: string | undefined, count: number) {
  const { t } = useTranslation();

  if (count <= 0 || href !== CHECKS_HREF) return "";

  return t(
    count === 1
      ? "accounting.checks.nav.outstandingAlert"
      : "accounting.checks.nav.outstandingAlert_plural",
    { count },
  );
}

export function useNavItemsAlertLabel(items: NavAlertItem[], count: number) {
  const { t } = useTranslation();

  if (count <= 0 || !itemTreeHasHref(items, CHECKS_HREF)) return "";

  return t(
    count === 1
      ? "accounting.checks.nav.outstandingAlert"
      : "accounting.checks.nav.outstandingAlert_plural",
    { count },
  );
}
