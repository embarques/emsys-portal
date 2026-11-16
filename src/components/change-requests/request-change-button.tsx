"use client";

import Link from "next/link";
import { FilePenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import type { ChangeResource } from "@/lib/change-requests/api";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";
import { cn } from "@/lib/utils";

type RequestChangeButtonProps = {
  resourceType: ChangeResource;
  resourceId: string;
  inSheet?: boolean;
  className?: string;
};

/** Navigation only. Submission requires a verified target and effective request permission. */
export function RequestChangeButton({
  resourceType,
  resourceId,
  inSheet = false,
  className,
}: RequestChangeButtonProps) {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  if (!hasPermission("canCreateChangeRequest", "change_request")) return null;

  const button = (
    <Button variant="outline" size="sm" className={cn("whitespace-nowrap", className)} asChild>
      <Link href={changeRequestHref(resourceType, resourceId)}>
        <FilePenLine className="size-4" />
        {t("accounting.journalLifecycle.request")}
      </Link>
    </Button>
  );

  return inSheet ? <div className="shrink-0 border-t px-6 py-4">{button}</div> : button;
}
