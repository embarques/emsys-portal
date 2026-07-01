"use client";

import { X } from "lucide-react";

import { SidebarBrand } from "@/components/brand/sidebar-brand";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { SidebarNav } from "./sidebar-nav";
import { SidebarProfileMenu } from "./sidebar-profile-menu";

type MobileSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true" aria-label={t("shell.mobileNav.label")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label={t("shell.mobileNav.closeSidebar")}
        onClick={() => onOpenChange(false)}
        onTouchStart={(event) => {
          event.preventDefault();
          onOpenChange(false);
        }}
      />

      <aside className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[88vw] flex-col border-r bg-card text-card-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between overflow-visible border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3 overflow-visible">
            <SidebarBrand />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation"
            aria-label={t("shell.mobileNav.closeMenu")}
            onClick={() => onOpenChange(false)}
            onTouchStart={(event) => {
              event.preventDefault();
              onOpenChange(false);
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </div>

        <div className="relative shrink-0 border-t p-4">
          <SidebarProfileMenu onNavigate={() => onOpenChange(false)} />
        </div>
      </aside>
    </div>
  );
}
