import type { LanguagePreference } from "@/lib/configuration/types";

import enCommon from "@/locales/en/common.json";
import enContainers from "@/locales/en/containers.json";
import enCustomers from "@/locales/en/customers.json";
import enDashboard from "@/locales/en/dashboard.json";
import enEmployees from "@/locales/en/employees.json";
import enInsights from "@/locales/en/insights.json";
import enItems from "@/locales/en/items.json";
import enInventory from "@/locales/en/inventory.json";
import enInvoices from "@/locales/en/invoices.json";
import enLabels from "@/locales/en/labels.json";
import enNavigation from "@/locales/en/navigation.json";
import enOrders from "@/locales/en/orders.json";
import enPhones from "@/locales/en/phones.json";
import enRoutes from "@/locales/en/routes.json";
import enSettings from "@/locales/en/settings.json";
import enShell from "@/locales/en/shell.json";
import enBarcodes from "@/locales/en/barcodes.json";
import enAccounting from "@/locales/en/accounting.json";
import enBranches from "@/locales/en/branches.json";
import enVehicles from "@/locales/en/vehicles.json";
import enReports from "@/locales/en/reports.json";
import enRoles from "@/locales/en/roles.json";
import enUsers from "@/locales/en/users.json";
import esCommon from "@/locales/es/common.json";
import esContainers from "@/locales/es/containers.json";
import esCustomers from "@/locales/es/customers.json";
import esDashboard from "@/locales/es/dashboard.json";
import esEmployees from "@/locales/es/employees.json";
import esInsights from "@/locales/es/insights.json";
import esItems from "@/locales/es/items.json";
import esInventory from "@/locales/es/inventory.json";
import esInvoices from "@/locales/es/invoices.json";
import esLabels from "@/locales/es/labels.json";
import esNavigation from "@/locales/es/navigation.json";
import esOrders from "@/locales/es/orders.json";
import esPhones from "@/locales/es/phones.json";
import esRoutes from "@/locales/es/routes.json";
import esSettings from "@/locales/es/settings.json";
import esShell from "@/locales/es/shell.json";
import esBarcodes from "@/locales/es/barcodes.json";
import esAccounting from "@/locales/es/accounting.json";
import esBranches from "@/locales/es/branches.json";
import esUsers from "@/locales/es/users.json";
import esVehicles from "@/locales/es/vehicles.json";
import esReports from "@/locales/es/reports.json";
import esRoles from "@/locales/es/roles.json";

export type Locale = LanguagePreference;

type MessageTree = Record<string, unknown>;

const catalogs: Record<Locale, MessageTree> = {
  en: {
    accounting: enAccounting,
    barcodes: enBarcodes,
    common: enCommon,
    containers: enContainers,
    customers: enCustomers,
    dashboard: enDashboard,
    employees: enEmployees,
    insights: enInsights,
    inventory: enInventory,
    items: enItems,
    invoices: enInvoices,
    labels: enLabels,
    navigation: enNavigation,
    orders: enOrders,
    phones: enPhones,
    reports: enReports,
    routes: enRoutes,
    settings: enSettings,
    shell: enShell,
    branches: enBranches,
    vehicles: enVehicles,
    roles: enRoles,
    users: enUsers,
  },
  es: {
    accounting: esAccounting,
    barcodes: esBarcodes,
    common: esCommon,
    containers: esContainers,
    customers: esCustomers,
    dashboard: esDashboard,
    employees: esEmployees,
    insights: esInsights,
    inventory: esInventory,
    items: esItems,
    invoices: esInvoices,
    labels: esLabels,
    navigation: esNavigation,
    orders: esOrders,
    phones: esPhones,
    reports: esReports,
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

function readPath(node: unknown, segments: string[]): string | undefined {
  if (segments.length === 0) {
    return typeof node === "string" ? node : undefined;
  }

  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return undefined;
  }

  const record = node as MessageTree;
  for (let take = 1; take <= segments.length; take += 1) {
    const literal = segments.slice(0, take).join(".");
    if (!(literal in record)) continue;

    const found = readPath(record[literal], segments.slice(take));
    if (found !== undefined) return found;
  }

  return undefined;
}

/** Resolve a dotted catalog key, including JSON keys that themselves contain dots. */
export function lookupCatalogValue(tree: MessageTree, key: string): string | undefined {
  return readPath(tree, key.split("."));
}

function readNestedValue(tree: MessageTree, key: string): string | undefined {
  return lookupCatalogValue(tree, key);
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
