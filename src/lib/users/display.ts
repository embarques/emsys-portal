import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { User, UserBranch, UserLanguage, UserStatus } from "./types";
import { isAdminRole, USER_LANGUAGES, USER_STATUSES } from "./types";

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

export function getUserLanguageLabel(language: UserLanguage): string {
  return USER_LANGUAGES.find((entry) => entry.value === language)?.label ?? language;
}

export function truncateUserId(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function truncateUid(uid: string): string {
  return uid.length > 16 ? `${uid.slice(0, 12)}…` : uid;
}
