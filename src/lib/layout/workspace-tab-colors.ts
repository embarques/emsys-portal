import type { CSSProperties } from "react";

import {
  navigation,
  topNavigationItems,
  type NavigationGroup,
  type NavigationItem,
} from "@/config/navigation";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";

/** Preset swatches for the tab color picker (Chrome-style). */
export const WORKSPACE_TAB_PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;

/**
 * Logical workspace sections used for default tab accent colors.
 * Keys mirror top-level sidebar groups / manager menus (not leaf pages).
 */
export type WorkspaceTabSection =
  | "dashboard"
  | "customers"
  | "pickups"
  | "invoices"
  | "inventory"
  | "barcodes"
  | "vehicles"
  | "accounting"
  | "insights"
  | "admin";

/** Default top-edge accent per section (subtle, Chrome-style). */
export const WORKSPACE_TAB_SECTION_COLORS: Record<WorkspaceTabSection, string> = {
  dashboard: "#64748b",
  customers: "#22c55e",
  pickups: "#3b82f6",
  invoices: "#f97316",
  inventory: "#06b6d4",
  barcodes: "#6366f1",
  vehicles: "#8b5cf6",
  accounting: "#eab308",
  insights: "#ec4899",
  admin: "#ef4444",
};

/**
 * Sidebar group / manager `labelKey` / `titleKey` → tab section.
 * Keep in sync with `src/config/navigation.ts` top-level menus.
 */
const NAV_LABEL_TO_SECTION: Record<string, WorkspaceTabSection> = {
  "navigation.items.dashboard": "dashboard",
  "navigation.items.customers": "customers",
  "navigation.items.orders": "pickups",
  "navigation.items.invoices": "invoices",
  "navigation.items.items": "invoices",
  "navigation.items.containers": "invoices",
  "navigation.submenus.routes": "pickups",
  "navigation.submenus.barcodeManager": "barcodes",
  "navigation.submenus.inventory": "inventory",
  "navigation.items.vehicles": "vehicles",
  "navigation.groups.accounting": "accounting",
  "navigation.groups.insights": "insights",
  "navigation.groups.admin": "admin",
};

/**
 * Form-tab feature keys → section accents.
 * Aligns with sidebar manager groups (Order, Invoices, Barcode, Inventory, etc.).
 */
const WORKSPACE_TAB_FEATURE_SECTIONS: Record<string, WorkspaceTabSection> = {
  customers: "customers",
  orders: "pickups",
  "pickup-routes": "pickups",
  "daily-routes": "pickups",
  // Route templates are opened from the Routes → Daily routes create flow.
  routes: "pickups",
  invoices: "invoices",
  "invoice-item-staging": "invoices",
  items: "invoices",
  containers: "invoices",
  "delivery-routes": "pickups",
  barcodes: "barcodes",
  "label-updater": "barcodes",
  vehicles: "vehicles",
  "daily-income-transactions": "accounting",
  users: "admin",
  roles: "admin",
  employees: "admin",
  branches: "admin",
};

/** Extra list/map routes not present as nav leaves (or opened outside the sidebar). */
const WORKSPACE_TAB_PATH_SECTION_EXTRAS: Record<string, WorkspaceTabSection> = {
  "/appointments/map": "pickups",
  "/inventory": "inventory",
  "/routes": "pickups",
};

function collectLeafHrefs(
  items: NavigationItem[],
  section: WorkspaceTabSection,
  into: Record<string, WorkspaceTabSection>,
) {
  for (const item of items) {
    if (item.children?.length) {
      collectLeafHrefs(item.children, section, into);
      continue;
    }
    if (item.href) {
      into[item.href] = section;
    }
  }
}

/** Build path → section from the live navigation hierarchy. */
function buildPathSectionsFromNavigation(
  groups: NavigationGroup[],
  topItems: NavigationItem[],
): Record<string, WorkspaceTabSection> {
  const pathSections: Record<string, WorkspaceTabSection> = {
    ...WORKSPACE_TAB_PATH_SECTION_EXTRAS,
  };

  for (const item of topItems) {
    const section = NAV_LABEL_TO_SECTION[item.labelKey];
    if (!section) continue;
    collectLeafHrefs([item], section, pathSections);
  }

  for (const group of groups) {
    const section = NAV_LABEL_TO_SECTION[group.titleKey];
    if (!section) continue;
    collectLeafHrefs(group.items, section, pathSections);
  }

  return pathSections;
}

const WORKSPACE_TAB_PATH_SECTIONS = buildPathSectionsFromNavigation(
  navigation,
  topNavigationItems,
);

export function normalizeWorkspaceTabColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

export function resolveWorkspaceTabSection(
  tab: Pick<WorkspaceTab, "href" | "form">,
): WorkspaceTabSection | null {
  if (tab.form?.feature) {
    return WORKSPACE_TAB_FEATURE_SECTIONS[tab.form.feature] ?? null;
  }

  const pathname = tab.href.split("?")[0] ?? tab.href;
  return WORKSPACE_TAB_PATH_SECTIONS[pathname] ?? null;
}

export function resolveWorkspaceSectionColor(
  section: WorkspaceTabSection,
  sectionColorOverrides?: Partial<Record<WorkspaceTabSection, string>>,
): string {
  return sectionColorOverrides?.[section] ?? WORKSPACE_TAB_SECTION_COLORS[section];
}

export function getEffectiveWorkspaceSectionColors(
  sectionColorOverrides?: Partial<Record<WorkspaceTabSection, string>>,
): Record<WorkspaceTabSection, string> {
  return {
    ...WORKSPACE_TAB_SECTION_COLORS,
    ...sectionColorOverrides,
  };
}

/**
 * When a tab's section picks another section's preset accent, swap the two section colors.
 */
export function swapWorkspaceSectionColor(
  sectionColorOverrides: Partial<Record<WorkspaceTabSection, string>> | undefined,
  fromSection: WorkspaceTabSection,
  pickedColor: string,
): Partial<Record<WorkspaceTabSection, string>> {
  const normalizedPicked = normalizeWorkspaceTabColor(pickedColor);
  if (!normalizedPicked) return sectionColorOverrides ?? {};

  const effective = getEffectiveWorkspaceSectionColors(sectionColorOverrides);
  const currentFromColor = effective[fromSection];
  if (normalizedPicked === currentFromColor) {
    return sectionColorOverrides ?? {};
  }

  const targetSection = (
    Object.entries(effective) as Array<[WorkspaceTabSection, string]>
  ).find(([section, color]) => section !== fromSection && color === normalizedPicked)?.[0];

  const next = { ...(sectionColorOverrides ?? {}) };

  if (targetSection) {
    next[fromSection] = normalizedPicked;
    next[targetSection] = currentFromColor;
    return next;
  }

  next[fromSection] = normalizedPicked;
  return next;
}

/** Custom picks always override the section accent without swapping other sections. */
export function setWorkspaceSectionColorOverride(
  sectionColorOverrides: Partial<Record<WorkspaceTabSection, string>> | undefined,
  section: WorkspaceTabSection,
  pickedColor: string,
): Partial<Record<WorkspaceTabSection, string>> {
  const normalizedPicked = normalizeWorkspaceTabColor(pickedColor);
  if (!normalizedPicked) return sectionColorOverrides ?? {};

  const effective = getEffectiveWorkspaceSectionColors(sectionColorOverrides);
  if (normalizedPicked === effective[section]) {
    return sectionColorOverrides ?? {};
  }

  return {
    ...(sectionColorOverrides ?? {}),
    [section]: normalizedPicked,
  };
}

export function resetWorkspaceSectionColor(
  sectionColorOverrides: Partial<Record<WorkspaceTabSection, string>> | undefined,
  section: WorkspaceTabSection,
): Partial<Record<WorkspaceTabSection, string>> | undefined {
  if (!sectionColorOverrides?.[section]) return sectionColorOverrides;

  const effective = getEffectiveWorkspaceSectionColors(sectionColorOverrides);
  const removedColor = effective[section];
  const defaultColor = WORKSPACE_TAB_SECTION_COLORS[section];

  const next = { ...sectionColorOverrides };
  delete next[section];

  // Undo a pairwise swap so the partner section also returns to its default.
  const swappedPartner = (
    Object.entries(next) as Array<[WorkspaceTabSection, string]>
  ).find(
    ([otherSection, color]) =>
      otherSection !== section &&
      color === defaultColor &&
      WORKSPACE_TAB_SECTION_COLORS[otherSection] === removedColor,
  )?.[0];

  if (swappedPartner) {
    delete next[swappedPartner];
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

/** Section accent wins so list + form tabs in the same area always match. */
export function resolveWorkspaceTabAccentColor(
  tab: Pick<WorkspaceTab, "href" | "form" | "color">,
  sectionColorOverrides?: Partial<Record<WorkspaceTabSection, string>>,
): string | null {
  const section = resolveWorkspaceTabSection(tab);
  if (section) {
    return resolveWorkspaceSectionColor(section, sectionColorOverrides);
  }

  return normalizeWorkspaceTabColor(tab.color);
}

/** Subtle top-edge stripe only — no background tint. */
export function getWorkspaceTabTopAccentStyle(
  color: string | null | undefined,
  active: boolean,
): CSSProperties | undefined {
  const normalized = normalizeWorkspaceTabColor(color);
  if (!normalized) return undefined;

  return {
    height: active ? 3 : 2,
    backgroundColor: normalized,
  };
}
