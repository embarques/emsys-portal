import { formatBranchFilterLabel } from "@/lib/branches/display";

export type BranchRef = {
  id: number;
  code: string;
  name?: string;
};

export function sameBranchCode(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function findBranchByCodeOrId(
  branches: BranchRef[],
  ref?: Pick<BranchRef, "id" | "code" | "name"> | null,
): BranchRef | undefined {
  if (!ref) return undefined;

  const code = ref.code?.trim() ?? "";
  if (code) {
    const byCode = branches.find((branch) => sameBranchCode(branch.code, code));
    if (byCode) return byCode;
  }

  if (ref.id > 0) {
    const byId = branches.find((branch) => branch.id === ref.id);
    if (byId) return byId;
  }

  const name = ref.name?.trim().toLowerCase() ?? "";
  if (!name) return undefined;
  return branches.find((branch) => branch.name.trim().toLowerCase() === name);
}

export function resolveUserBranchCode(
  userBranch: BranchRef | undefined,
  branches: BranchRef[],
): string {
  return resolveUserBranchRef(userBranch, branches)?.code ?? "";
}

export function resolveUserBranchRef(
  userBranch: BranchRef | undefined,
  branches: BranchRef[],
): { id: number; code: string; name: string } | null {
  if (!userBranch) return null;

  const match = findBranchByCodeOrId(branches, userBranch);
  const code = match?.code.trim() || userBranch.code.trim();
  if (!code) return null;

  return {
    id: match?.id || userBranch.id,
    code: match?.code.trim() || code,
    name: match?.name?.trim() || userBranch.name?.trim() || "",
  };
}

export function buildFormBranchOptions(
  branches: BranchRef[],
  extra?: BranchRef | null,
): Array<{ value: string; label: string; keywords?: string[] }> {
  const extras =
    extra?.code.trim() &&
    !branches.some((branch) => sameBranchCode(branch.code, extra.code))
      ? [extra]
      : [];

  return [...extras, ...branches].map((branch) => ({
    value: branch.code,
    label: formatBranchFilterLabel({
      id: branch.id,
      code: branch.code,
      name: branch.name ?? "",
    }),
    keywords: [branch.code, branch.name ?? ""],
  }));
}
