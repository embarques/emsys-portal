import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { User, UserBranch, UserLanguage, UserRole, UserStatus } from "./types";
import { USER_LANGUAGES, USER_ROLES, USER_STATUSES } from "./types";

export function getUserBranchLabel(branch: UserBranch): string {
  return getBranchLabel(branch);
}

export function getUserBranchBadgeClass(branch: UserBranch): string {
  return getBranchBadgeClass(branch);
}

export function getUserStatusLabel(status: UserStatus): string {
  return USER_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function getUserStatusBadgeClass(status: UserStatus): string {
  return status === "active"
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function getUserRoleLabel(role: UserRole): string {
  return USER_ROLES.find((entry) => entry.value === role)?.label ?? role;
}

export function getUserRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case "admin":
      return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "manager":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "viewer":
      return "border-transparent bg-muted text-muted-foreground";
    default:
      return "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300";
  }
}

export function getUserLanguageLabel(language: UserLanguage): string {
  return USER_LANGUAGES.find((entry) => entry.value === language)?.label ?? language;
}

export function truncateUserId(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function userMatchesQuery(user: User, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    user.userId,
    user.username,
    user.name,
    getUserRoleLabel(user.role),
    getUserLanguageLabel(user.language),
    getUserBranchLabel(user.branch),
    user.email,
    user.phone,
    getUserStatusLabel(user.status),
    user.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeUserKpis(users: User[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.status === "active").length,
    inactive: users.filter((user) => user.status === "inactive").length,
    admin: users.filter((user) => user.role === "admin").length,
  };
}
