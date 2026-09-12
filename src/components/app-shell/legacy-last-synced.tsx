"use client";

import { useTranslation } from "@/lib/i18n";
import { formatLastSyncedAt } from "@/lib/legacy-sync/last-synced";

export function LegacyLastSynced({ at }: { at: string | null }) {
  const { t, locale } = useTranslation();
  const formatted = at ? formatLastSyncedAt(at, locale) : "";

  return (
    <p className="text-xs text-muted-foreground">
      {formatted
        ? t("common.legacySync.lastSynced", { at: formatted })
        : t("common.legacySync.neverSynced")}
    </p>
  );
}
