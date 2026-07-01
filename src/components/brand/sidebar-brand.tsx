"use client";

import { EmsysLogo } from "@/components/brand/emsys-logo";
import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import { siteConfig } from "@/config/site";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SidebarBrandProps = {
  /** Icon only — collapsed sidebar rail. */
  compact?: boolean;
  className?: string;
  priority?: boolean;
};

export function SidebarBrand({ compact = false, className, priority = false }: SidebarBrandProps) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <WorkspaceNavLink
        href="/"
        label="Dashboard"
        aria-label="Dashboard"
        className={cn("flex items-center justify-center leading-none", className)}
      >
        <EmsysLogo variant="mark" priority={priority} />
      </WorkspaceNavLink>
    );
  }

  return (
    <WorkspaceNavLink
      href="/"
      label="Dashboard"
      aria-label="Dashboard"
      className={cn("flex min-w-0 items-center gap-3 leading-none", className)}
    >
      <EmsysLogo variant="mark" priority={priority} className="shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-none text-foreground">{siteConfig.name}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{t("shell.brand.company")}</p>
      </div>
    </WorkspaceNavLink>
  );
}
