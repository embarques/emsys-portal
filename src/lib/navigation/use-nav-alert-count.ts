"use client";

import { useOutstandingChecksCount } from "@/lib/accounting/checks/hooks/use-checks";
import {
  CREDIT_CARD_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  ZELLE_PAYMENTS_CONFIG,
} from "@/lib/accounting/clearable-payments/configs";
import { useOutstandingClearablePaymentsCount } from "@/lib/accounting/clearable-payments/hooks";
import { useTranslation } from "@/lib/i18n";

const PENDING_FINANCIAL_ACTIVITY_HREF = "/accounting/pending-financial-activity";

type NavAlertItem = { href?: string; children?: Array<{ href?: string }> };

function itemTreeHasHref(items: NavAlertItem[], href: string): boolean {
  return items.some((item) => item.href === href || item.children?.some((child) => child.href === href));
}

/** Outstanding checks, Zelle, deposits, and credit card payments awaiting clearance. */
function useOutstandingPaymentsCount() {
  const checks = useOutstandingChecksCount();
  const zelle = useOutstandingClearablePaymentsCount(ZELLE_PAYMENTS_CONFIG);
  const deposits = useOutstandingClearablePaymentsCount(DEPOSITS_CONFIG);
  const creditCards = useOutstandingClearablePaymentsCount(CREDIT_CARD_PAYMENTS_CONFIG);
  return checks + zelle + deposits + creditCards;
}

export function useNavAlertCount(href?: string) {
  const outstanding = useOutstandingPaymentsCount();
  return href === PENDING_FINANCIAL_ACTIVITY_HREF ? outstanding : 0;
}

export function useNavItemsAlertCount(items: NavAlertItem[]) {
  const outstanding = useOutstandingPaymentsCount();
  return itemTreeHasHref(items, PENDING_FINANCIAL_ACTIVITY_HREF) ? outstanding : 0;
}

function useOutstandingPaymentsLabel(show: boolean, count: number) {
  const { t } = useTranslation();

  if (!show || count <= 0) return "";

  return t(
    count === 1
      ? "accounting.clearablePayments.nav.outstandingAlert"
      : "accounting.clearablePayments.nav.outstandingAlert_plural",
    { count },
  );
}

export function useNavAlertLabel(href: string | undefined, count: number) {
  return useOutstandingPaymentsLabel(href === PENDING_FINANCIAL_ACTIVITY_HREF, count);
}

export function useNavItemsAlertLabel(items: NavAlertItem[], count: number) {
  return useOutstandingPaymentsLabel(itemTreeHasHref(items, PENDING_FINANCIAL_ACTIVITY_HREF), count);
}
