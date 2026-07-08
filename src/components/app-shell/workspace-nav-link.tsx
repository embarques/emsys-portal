"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useIsDesktopWorkspaceTabs, useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { isWorkspaceRoute } from "@/lib/layout/workspace-registry";
import { cn } from "@/lib/utils";

type WorkspaceNavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  label: string;
};

export function WorkspaceNavLink({
  href,
  label,
  className,
  onClick,
  children,
  ...props
}: WorkspaceNavLinkProps) {
  const isMobile = useIsMobileViewport();
  const isDesktopTabs = useIsDesktopWorkspaceTabs();
  const { openTab } = useWorkspaceTabs();
  const { t } = useTranslation();

  if (isMobile || !isDesktopTabs || !isWorkspaceRoute(href)) {
    return (
      <Link href={href} className={className} onClick={onClick} {...props}>
        {children}
      </Link>
    );
  }

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, forceNew: boolean) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.shiftKey || event.altKey) return;

    event.preventDefault();
    openTab(href, label, { forceNew });
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={href}
          className={className}
          onClick={(event) => handleNavigate(event, event.metaKey || event.ctrlKey)}
          {...props}
        >
          {children}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => openTab(href, label, { forceNew: true })}>
          {t("shell.tabs.openInNewTab")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function workspaceNavLinkClassName(active: boolean, baseClassName?: string) {
  return cn(baseClassName, active && "bg-primary/10 font-medium text-primary");
}
