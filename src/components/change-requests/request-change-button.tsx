"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import type { ChangeResource } from "@/lib/change-requests/api";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";

/** Navigation only. Submission requires a verified target and effective request permission. */
export function RequestChangeButton({ resourceType, resourceId, inSheet = false }: { resourceType: ChangeResource; resourceId: string; inSheet?: boolean }) {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  if (!hasPermission("canCreateChangeRequest", "change_request")) return null;
  const button = <Button variant="outline" size="sm" asChild>
    <Link href={changeRequestHref(resourceType, resourceId)}>{t("accounting.journalLifecycle.request")}</Link>
  </Button>;
  return inSheet ? <div className="shrink-0 border-t px-6 py-4">{button}</div> : button;
}
