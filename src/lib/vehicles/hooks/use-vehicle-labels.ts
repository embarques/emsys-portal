import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { getVehiclePortalBranch } from "@/lib/vehicles/types";

export function useVehicleLabels() {
  const { t } = useTranslation();

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
        const portal = getVehiclePortalBranch(trimmed);
        return t(`vehicles.enums.branch.${portal}`);
      },
      active: (active: boolean) =>
        t(active ? "vehicles.enums.status.active" : "vehicles.enums.status.inactive"),
    }),
    [t],
  );
}
