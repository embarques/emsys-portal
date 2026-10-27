"use client";

import { version as portalVersion } from "../../../package.json";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useSessionVersion } from "@/lib/system/hooks/use-session-version";

export function AboutDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const apiVersion = useSessionVersion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("shell.profileMenu.about")}</DialogTitle>
          <DialogDescription>{t("shell.profileMenu.aboutDescription")}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("shell.profileMenu.portalVersion")}</dt>
            <dd className="font-medium">{portalVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("shell.profileMenu.apiVersion")}</dt>
            <dd className="font-medium" aria-live="polite">
              {apiVersion.data ?? t(apiVersion.isError
                ? "shell.profileMenu.versionUnavailable" : "common.loading")}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
