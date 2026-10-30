"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function DevSessionBanner() {
  const { t } = useTranslation();
  const { isAuthBypass, email, companyId, devSessionExpiresAt, signOut } = useAuth();

  if (!isAuthBypass) return null;

  const expiresLabel =
    devSessionExpiresAt && devSessionExpiresAt > Date.now()
      ? t("shell.devAuth.banner.expires", { date: new Date(devSessionExpiresAt).toLocaleString() })
      : t("shell.devAuth.banner.expired");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <span>
        <strong>{t("shell.devAuth.banner.title")}</strong>
        {" · "}
        {email ?? "—"}
        {" · "}
        {companyId ?? "—"}
        {" · "}
        {expiresLabel}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
        {t("shell.devAuth.banner.clear")}
      </Button>
    </div>
  );
}
