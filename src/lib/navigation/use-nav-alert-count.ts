"use client";

import { useOutstandingChecksCount } from "@/lib/accounting/checks/hooks/use-checks";
import {
  CREDIT_CARD_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  ZELLE_PAYMENTS_CONFIG,
  type ClearablePaymentMethodConfig,
} from "@/lib/accounting/clearable-payments/configs";
import { useOutstandingClearablePaymentsCount } from "@/lib/accounting/clearable-payments/hooks";
import { useTranslation } from "@/lib/i18n";

const CHECKS_HREF = "/accounting/checks";

const CLEARABLE_PAYMENT_CONFIGS: ClearablePaymentMethodConfig[] = [
  ZELLE_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  CREDIT_CARD_PAYMENTS_CONFIG,
];

type NavAlertItem = { href?: string; children?: Array<{ href?: string }> };

function clearableConfigForHref(href: string | undefined): ClearablePaymentMethodConfig | undefined {
  return CLEARABLE_PAYMENT_CONFIGS.find((config) => config.href === href);
}

function alertCountForHref(
  href: string | undefined,
  outstandingChecks: number,
  outstandingByHref: Record<string, number>,
) {
  if (href === CHECKS_HREF) return outstandingChecks;
  if (href && href in outstandingByHref) return outstandingByHref[href] ?? 0;
  return 0;
}

function itemTreeHasHref(items: NavAlertItem[], href: string): boolean {
  return items.some((item) => item.href === href || item.children?.some((child) => child.href === href));
}

function useOutstandingClearableByHref() {
  const zelle = useOutstandingClearablePaymentsCount(ZELLE_PAYMENTS_CONFIG);
  const deposits = useOutstandingClearablePaymentsCount(DEPOSITS_CONFIG);
  const creditCards = useOutstandingClearablePaymentsCount(CREDIT_CARD_PAYMENTS_CONFIG);

  return {
    [ZELLE_PAYMENTS_CONFIG.href]: zelle,
    [DEPOSITS_CONFIG.href]: deposits,
    [CREDIT_CARD_PAYMENTS_CONFIG.href]: creditCards,
  } satisfies Record<string, number>;
}

export function useNavAlertCount(href?: string) {
  const outstandingChecks = useOutstandingChecksCount();
  const outstandingByHref = useOutstandingClearableByHref();
  return alertCountForHref(href, outstandingChecks, outstandingByHref);
}

export function useNavItemsAlertCount(items: NavAlertItem[]) {
  const outstandingChecks = useOutstandingChecksCount();
  const outstandingByHref = useOutstandingClearableByHref();

  return items.reduce((total, item) => {
    return (
      total +
      alertCountForHref(item.href, outstandingChecks, outstandingByHref) +
      (item.children?.reduce(
        (nestedTotal, child) =>
          nestedTotal + alertCountForHref(child.href, outstandingChecks, outstandingByHref),
        0,
      ) ?? 0)
    );
  }, 0);
}

export function useNavAlertLabel(href: string | undefined, count: number) {
  const { t } = useTranslation();

  if (count <= 0 || !href) return "";

  if (href === CHECKS_HREF) {
    return t(
      count === 1
        ? "accounting.checks.nav.outstandingAlert"
        : "accounting.checks.nav.outstandingAlert_plural",
      { count },
    );
  }

  const config = clearableConfigForHref(href);
  if (!config) return "";

  return t(
    count === 1
      ? `accounting.${config.i18nKey}.nav.outstandingAlert`
      : `accounting.${config.i18nKey}.nav.outstandingAlert_plural`,
    { count },
  );
}

export function useNavItemsAlertLabel(items: NavAlertItem[], count: number) {
  const { t } = useTranslation();

  if (count <= 0) return "";

  const hasChecks = itemTreeHasHref(items, CHECKS_HREF);
  const matchingClearable = CLEARABLE_PAYMENT_CONFIGS.filter((config) =>
    itemTreeHasHref(items, config.href),
  );
  const clearingDirectoryCount = (hasChecks ? 1 : 0) + matchingClearable.length;

  if (clearingDirectoryCount > 1) {
    return t(
      count === 1
        ? "accounting.clearablePayments.nav.outstandingAlert"
        : "accounting.clearablePayments.nav.outstandingAlert_plural",
      { count },
    );
  }

  if (hasChecks) {
    return t(
      count === 1
        ? "accounting.checks.nav.outstandingAlert"
        : "accounting.checks.nav.outstandingAlert_plural",
      { count },
    );
  }

  const config = matchingClearable[0];
  if (!config) return "";

  return t(
    count === 1
      ? `accounting.${config.i18nKey}.nav.outstandingAlert`
      : `accounting.${config.i18nKey}.nav.outstandingAlert_plural`,
    { count },
  );
}
