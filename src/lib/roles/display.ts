import { getPermissionLabel } from "./permissions-catalog";
import type { Role } from "./types";

export function truncateRoleId(roleId: string): string {
  return roleId.length > 12 ? `${roleId.slice(0, 8)}…` : roleId;
}

export function formatPermissionsSummary(role: Role, limit = 3): string {
  if (role.permissions.length === 0) return "—";

  const labels = role.permissions.map((permission) => getPermissionLabel(permission.value));
  const visible = labels.slice(0, limit);
  const suffix = labels.length > limit ? ` (+${labels.length - limit})` : "";
  return `${visible.join(", ")}${suffix}`;
}

export function roleMatchesQuery(role: Role, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const permissionText = role.permissions.map((permission) => getPermissionLabel(permission.value)).join(" ");

  return [role.roleId, role.name, permissionText, role.createdBy, String(role.permissions.length)]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRoleKpis(roles: Role[]) {
  const permissionCounts = roles.map((role) => role.permissions.length);
  const totalPermissions = permissionCounts.reduce((sum, count) => sum + count, 0);

  return {
    total: roles.length,
    totalPermissions,
    averagePermissions:
      roles.length > 0 ? Math.round((totalPermissions / roles.length) * 10) / 10 : 0,
  };
}
