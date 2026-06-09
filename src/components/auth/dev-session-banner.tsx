"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function DevSessionBanner() {
  const { isAuthBypass, email, companyId, devSessionExpiresAt, signOut } = useAuth();

  if (!isAuthBypass) return null;

  const expiresLabel =
    devSessionExpiresAt && devSessionExpiresAt > Date.now()
      ? `Expires ${new Date(devSessionExpiresAt).toLocaleString()}`
      : "Session expired";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <span>
        <strong>Dev session</strong>
        {" · "}
        {email ?? "—"}
        {" · "}
        {companyId ?? "—"}
        {" · "}
        {expiresLabel}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
        Clear session
      </Button>
    </div>
  );
}
