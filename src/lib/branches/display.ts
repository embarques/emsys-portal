import type { Branch } from "@/lib/branches/types";
import { formatPhoneForDisplay } from "@/lib/utils/phone";

export function formatBranchFilterLabel(branch: Pick<Branch, "id" | "name" | "code">): string {
  const name = branch.name.trim();
  const code = branch.code.trim();

  if (name && code) return `${name} (${code})`;
  return name || code || `Branch ${branch.id}`;
}

export function formatBranchId(id: number): string {
  return id > 0 ? String(id) : "—";
}

export function formatBranchAddress(branch: Pick<Branch, "address">): string {
  const { address } = branch;
  const parts = [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ].filter((part) => part.trim());

  return parts.length > 0 ? parts.join(", ") : "—";
}

export function formatBranchPhones(branch: Pick<Branch, "phone1" | "phone2">): string {
  const phones = [branch.phone1, branch.phone2]
    .map((phone) => formatPhoneForDisplay(phone))
    .filter(Boolean);
  return phones.length > 0 ? phones.join(" · ") : "—";
}

export function getBranchTypeBadgeClass(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "usa" || normalized === "us") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
  if (normalized === "dr" || normalized === "do") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  }
  return "border-border bg-muted text-muted-foreground";
}
