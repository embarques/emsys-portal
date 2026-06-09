import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { User, UserPortalBranch } from "./types";
import { getUserPortalBranch, isAdminRole, USER_ACTIVE_OPTIONS } from "./types";

export function getUserActiveLabel(active: boolean): string {
  return USER_ACTIVE_OPTIONS.find((entry) => entry.value === active)?.label ?? (active ? "Active" : "Inactive");
}

export function getUserActiveBadgeClass(active: boolean): string {
  return active
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function getUserBranchLabel(branch: UserPortalBranch): string {
  return getBranchLabel(branch);
}

export function getUserBranchBadgeClass(user: User): string {
  return getBranchBadgeClass(getUserPortalBranch(user));
}

export function getUserRoleLabel(roleName: string): string {
  return roleName.trim() || "—";
}

export function getUserRoleBadgeClass(roleName: string): string {
  if (isAdminRole(roleName)) {
    return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }

  const normalized = roleName.trim().toLowerCase();
  if (normalized.includes("manager") || normalized.includes("gerente")) {
    return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }

  if (normalized.includes("viewer") || normalized.includes("lectura")) {
    return "border-transparent bg-muted text-muted-foreground";
  }

  return "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300";
}

export function formatUserBranchLabel(user: User): string {
  const portalBranch = getUserPortalBranch(user);
  const branchLabel = getUserBranchLabel(portalBranch);
  const details = [user.branch.name, user.branch.code].filter(Boolean).join(" · ");
  return details ? `${branchLabel} (${details})` : branchLabel;
}

export function truncateUserId(userId: number): string {
  const value = String(userId);
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function truncateUid(uid: string): string {
  return uid.length > 16 ? `${uid.slice(0, 12)}…` : uid;
}
