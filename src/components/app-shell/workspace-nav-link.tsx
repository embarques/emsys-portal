"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { isWorkspaceRoute } from "@/lib/layout/workspace-registry";
import { cn } from "@/lib/utils";

type WorkspaceNavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  label: string;
};

function shouldOpenInAppTab(event: MouseEvent<HTMLAnchorElement>) {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

export function WorkspaceNavLink({
  href,
  label,
  className,
  onClick,
  children,
  ...props
}: WorkspaceNavLinkProps) {
  const isMobile = useIsMobileViewport();
  const { openTab } = useWorkspaceTabs();

  if (isMobile || !isWorkspaceRoute(href)) {
    return (
      <Link href={href} className={className} onClick={onClick} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!shouldOpenInAppTab(event)) return;

        event.preventDefault();
        openTab(href, label);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

export function workspaceNavLinkClassName(active: boolean, baseClassName?: string) {
  return cn(baseClassName, active && "bg-primary/10 font-medium text-primary");
}
