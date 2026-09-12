import type { Branch } from "@/lib/branches/types";
import { formatRecordPhoneList } from "@/lib/phones/phones";

type BranchRef = Pick<Branch, "id" | "name" | "code">;
type BranchRefWithType = Pick<Branch, "id" | "name" | "code" | "type">;

export function findBranchByCode(
  code: string,
  branches: BranchRef[] = [],
): BranchRef | undefined {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return undefined;
  return branches.find((branch) => branch.code.trim().toLowerCase() === normalized);
}

/** Branch code only — for table columns (e.g. NY, RD). */
export function formatBranchCodeOnly(code: string, branches: BranchRef[] = []): string {
  const trimmed = code.trim();
  if (!trimmed) return "—";
  const match = findBranchByCode(trimmed, branches);
  return (match?.code.trim() || trimmed).toUpperCase();
}

/** Display label for a branch code, resolving name from the branch directory when available. */
export function formatBranchCodeLabel(code: string, branches: BranchRef[] = []): string {
  const trimmed = code.trim();
  if (!trimmed) return "—";

  const match = findBranchByCode(trimmed, branches);
  if (match) return formatBranchFilterLabel(match);

  const normalized = trimmed.toLowerCase();
  if (normalized === "usa" || normalized === "us") return "USA";
  if (normalized === "dr" || normalized === "do" || normalized === "rd") return "DR";

  return trimmed.toUpperCase();
}

/** Badge styling for a branch code, preferring branch type from the directory. */
export function getBranchCodeBadgeClass(code: string, branches: BranchRefWithType[] = []): string {
  const match = branches.find(
    (branch) => branch.code.trim().toLowerCase() === code.trim().toLowerCase(),
  );
  if (match?.type) return getBranchTypeBadgeClass(match.type);

  const normalized = code.trim().toLowerCase();
  if (normalized === "dr" || normalized === "do" || normalized === "rd") {
    return getBranchTypeBadgeClass("dr");
  }
  if (normalized === "usa" || normalized === "us") {
    return getBranchTypeBadgeClass("usa");
  }

  return "border-border bg-muted text-muted-foreground";
}

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

export function formatBranchPhones(branch: Pick<Branch, "phones">): string {
  return formatRecordPhoneList(branch.phones);
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
