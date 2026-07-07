import { useMemo } from "react";

import { formatBranchCodeLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";

export function useVehicleLabels() {
  const { t } = useTranslation();
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];

  return useMemo(
    () => ({
      fuelType: (value: string) => {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return t("common.empty.dash");
        const key = `vehicles.enums.fuelType.${normalized}`;
        const translated = t(key);
        return translated !== key ? translated : value;
      },
      branch: (code: string) => {
        const trimmed = code.trim();
        if (!trimmed) return t("common.empty.dash");
        return formatBranchCodeLabel(trimmed, branches);
      },
      active: (active: boolean) =>
        t(active ? "vehicles.enums.status.active" : "vehicles.enums.status.inactive"),
    }),
    [branches, t],
  );
}
