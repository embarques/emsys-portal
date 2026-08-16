export type PermissionCatalogEntry = {
  id: string;
  value: string;
  label: string;
  group: string;
};

const PERMISSION_LABEL_OVERRIDES = new Map<string, string>([
  ["pickup:syncLegacyPickups", "Access legacy pickups"],
]);

function pluralize(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase().endsWith("s")) return normalized;
  if (normalized.toLowerCase().endsWith("y")) return `${normalized.slice(0, -1)}ies`;
  return `${normalized}s`;
}

export function formatPermissionGroup(resourceType: string): string {
  const words = resourceType
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "Other";

  words[words.length - 1] = pluralize(words[words.length - 1]);
  const label = words.join(" ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPermissionLabel(name: string, resourceType: string): string {
  const override = PERMISSION_LABEL_OVERRIDES.get(`${resourceType.trim()}:${name.trim()}`);
  if (override) return override;

  const group = formatPermissionGroup(resourceType).toLowerCase();
  const actionMatch = name.trim().replace(/^can/, "").match(/^[A-Z][a-z]*/);
  const action = actionMatch?.[0] ?? "Access";
  return `${action} ${group}`;
}

export function getPermissionCatalogGroups(catalog: PermissionCatalogEntry[]): string[] {
  return Array.from(new Set(catalog.map((entry) => entry.group)));
}

export function getPermissionsByGroup(
  group: string,
  catalog: PermissionCatalogEntry[],
): PermissionCatalogEntry[] {
  return catalog.filter((entry) => entry.group === group);
}

type PermissionCatalogSource = Pick<PermissionCatalogEntry, "id" | "value"> & {
  label?: string;
  group?: string;
};

export function mergePermissionCatalogEntries(
  catalog: PermissionCatalogEntry[],
  assigned: PermissionCatalogSource[],
): PermissionCatalogEntry[] {
  const merged = new Map<string, PermissionCatalogEntry>();

  for (const entry of catalog) {
    merged.set(entry.id, entry);
  }

  for (const permission of assigned) {
    if (merged.has(permission.id)) continue;

    merged.set(permission.id, {
      id: permission.id,
      value: permission.value,
      label: permission.label ?? permission.value,
      group: permission.group ?? "Other",
    });
  }

  return Array.from(merged.values());
}
