import type { LanguagePreference } from "@/lib/configuration/types";

import enCommon from "@/locales/en/common.json";
import enContainers from "@/locales/en/containers.json";
import enCustomers from "@/locales/en/customers.json";
import enInsights from "@/locales/en/insights.json";
import enItems from "@/locales/en/items.json";
import enInvoices from "@/locales/en/invoices.json";
import enNavigation from "@/locales/en/navigation.json";
import enPhones from "@/locales/en/phones.json";
import enRoutes from "@/locales/en/routes.json";
import enShell from "@/locales/en/shell.json";
import esCommon from "@/locales/es/common.json";
import esContainers from "@/locales/es/containers.json";
import esCustomers from "@/locales/es/customers.json";
import esInsights from "@/locales/es/insights.json";
import esItems from "@/locales/es/items.json";
import esInvoices from "@/locales/es/invoices.json";
import esNavigation from "@/locales/es/navigation.json";
import esPhones from "@/locales/es/phones.json";
import esRoutes from "@/locales/es/routes.json";
import esShell from "@/locales/es/shell.json";

export type Locale = LanguagePreference;

type MessageTree = Record<string, unknown>;

const catalogs: Record<Locale, MessageTree> = {
  en: {
    common: enCommon,
    containers: enContainers,
    customers: enCustomers,
    insights: enInsights,
    items: enItems,
    invoices: enInvoices,
    navigation: enNavigation,
    phones: enPhones,
    routes: enRoutes,
    shell: enShell,
  },
  es: {
    common: esCommon,
    containers: esContainers,
    customers: esCustomers,
    insights: esInsights,
    items: esItems,
    invoices: esInvoices,
    navigation: esNavigation,
    phones: esPhones,
    routes: esRoutes,
    shell: esShell,
  },
};

export function getCatalog(locale: Locale): MessageTree {
  return catalogs[locale] ?? catalogs.en;
}

function readNestedValue(tree: MessageTree, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in (current as MessageTree)) {
      return (current as MessageTree)[segment];
    }
    return undefined;
  }, tree);

  return typeof value === "string" ? value : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const localized = readNestedValue(getCatalog(locale), key);
  const fallback = readNestedValue(getCatalog("en"), key);
  let message = localized ?? fallback ?? key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      message = message.replaceAll(`{{${paramKey}}}`, String(paramValue));
    }
  }

  return message;
}
