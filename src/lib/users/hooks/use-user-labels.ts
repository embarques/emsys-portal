import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";

export function useUserLabels() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      active: (active: boolean) =>
        t(active ? "users.enums.status.active" : "users.enums.status.inactive"),
      column: (columnId: string) => {
        const key = `users.columns.${columnId}`;
        const translated = t(key);
        return translated !== key ? translated : columnId;
      },
    }),
    [t],
  );
}
