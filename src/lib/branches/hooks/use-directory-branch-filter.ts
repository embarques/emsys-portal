"use client";

import { useMemo, useState } from "react";

import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  resolveUserBranchCode,
  sameBranchCode,
} from "@/lib/branches/user-branch";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { useTranslation } from "@/lib/i18n";

/** Sentinel so "All branches" is a real option, not an empty SearchableSelect value. */
export const ALL_DIRECTORY_BRANCHES_VALUE = "__all__";

type DirectoryBranchOption = {
  value: string;
  label: string;
  keywords?: string[];
};

/**
 * Toolbar branch filter for route directories: defaults to the signed-in user's
 * branch, with All branches and every other branch available in the dropdown.
 */
export function useDirectoryBranchFilter() {
  const { t } = useTranslation();
  const currentUserQuery = useCurrentUser();
  const branchesQuery = useBranchPicker(200);
  const [overrideBranchCode, setOverrideBranchCode] = useState<string | undefined>(undefined);

  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const userBranch = currentUserQuery.data?.branch;
  const resolvedUserBranchCode = resolveUserBranchCode(userBranch, branches);

  const userSettled =
    Boolean(currentUserQuery.data) || currentUserQuery.isFetched || currentUserQuery.isError;
  const waitingForBranchDirectory =
    Boolean(userBranch && (userBranch.id > 0 || userBranch.name.trim())) &&
    !resolvedUserBranchCode &&
    branches.length === 0 &&
    (branchesQuery.isPending || branchesQuery.isFetching);

  const isReady = userSettled && !waitingForBranchDirectory;
  const branchCode = overrideBranchCode ?? (isReady ? resolvedUserBranchCode : "");
  const selectValue = !isReady
    ? ""
    : branchCode.trim()
      ? branchCode
      : ALL_DIRECTORY_BRANCHES_VALUE;

  const branchOptions = useMemo((): DirectoryBranchOption[] => {
    const extra =
      resolvedUserBranchCode &&
      !branches.some((branch) => sameBranchCode(branch.code, resolvedUserBranchCode))
        ? [
            {
              id: userBranch?.id ?? 0,
              code: resolvedUserBranchCode,
              name: userBranch?.name ?? resolvedUserBranchCode,
            },
          ]
        : [];

    return [
      {
        value: ALL_DIRECTORY_BRANCHES_VALUE,
        label: t("routes.table.allBranches"),
        keywords: ["all"],
      },
      ...[...extra, ...branches].map((branch) => ({
        value: branch.code,
        label: formatBranchFilterLabel(branch),
        keywords: [branch.code, branch.name],
      })),
    ];
  }, [branches, resolvedUserBranchCode, t, userBranch?.id, userBranch?.name]);

  return {
    /** Empty string lists every branch. */
    branchCode,
    /** Value bound to SearchableSelect, including the All sentinel. */
    selectValue,
    setBranchCode: (next: string) => {
      setOverrideBranchCode(next === ALL_DIRECTORY_BRANCHES_VALUE ? "" : next);
    },
    isReady,
    branchOptions,
    branches,
    branchesLoading: !isReady || branchesQuery.isLoading,
  };
}
