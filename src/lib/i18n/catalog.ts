import type { LanguagePreference } from "@/lib/configuration/types";

import enCommon from "@/locales/en/common.json";
import enContainers from "@/locales/en/containers.json";
import enCustomers from "@/locales/en/customers.json";
import enEmployees from "@/locales/en/employees.json";
import enInsights from "@/locales/en/insights.json";
import enItems from "@/locales/en/items.json";
import enInvoices from "@/locales/en/invoices.json";
import enLabels from "@/locales/en/labels.json";
import enNavigation from "@/locales/en/navigation.json";
import enOrders from "@/locales/en/orders.json";
import enPhones from "@/locales/en/phones.json";
import enRoutes from "@/locales/en/routes.json";
import enSettings from "@/locales/en/settings.json";
import enShell from "@/locales/en/shell.json";
import enBranches from "@/locales/en/branches.json";
import enVehicles from "@/locales/en/vehicles.json";
import enRoles from "@/locales/en/roles.json";
import enUsers from "@/locales/en/users.json";
import esCommon from "@/locales/es/common.json";
import esContainers from "@/locales/es/containers.json";
import esCustomers from "@/locales/es/customers.json";
import esEmployees from "@/locales/es/employees.json";
import esInsights from "@/locales/es/insights.json";
import esItems from "@/locales/es/items.json";
import esInvoices from "@/locales/es/invoices.json";
import esLabels from "@/locales/es/labels.json";
import esNavigation from "@/locales/es/navigation.json";
import esOrders from "@/locales/es/orders.json";
import esPhones from "@/locales/es/phones.json";
import esRoutes from "@/locales/es/routes.json";
import esSettings from "@/locales/es/settings.json";
import esShell from "@/locales/es/shell.json";
import esBranches from "@/locales/es/branches.json";
import esUsers from "@/locales/es/users.json";
import esVehicles from "@/locales/es/vehicles.json";
import esRoles from "@/locales/es/roles.json";

export type Locale = LanguagePreference;

type MessageTree = Record<string, unknown>;

const catalogs: Record<Locale, MessageTree> = {
  en: {
    common: enCommon,
    containers: enContainers,
    customers: enCustomers,
    employees: enEmployees,
    insights: enInsights,
    items: enItems,
    invoices: enInvoices,
    labels: enLabels,
    navigation: enNavigation,
    orders: enOrders,
    phones: enPhones,
    routes: enRoutes,
    settings: enSettings,
    shell: enShell,
    branches: enBranches,
    vehicles: enVehicles,
    roles: enRoles,
    users: enUsers,
  },
  es: {
    common: esCommon,
    containers: esContainers,
    customers: esCustomers,
    employees: esEmployees,
    insights: esInsights,
    items: esItems,
    invoices: esInvoices,
    labels: esLabels,
    navigation: esNavigation,
    orders: esOrders,
    phones: esPhones,
    routes: esRoutes,
    settings: esSettings,
    shell: esShell,
    branches: esBranches,
    vehicles: esVehicles,
    roles: esRoles,
    users: esUsers,
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
