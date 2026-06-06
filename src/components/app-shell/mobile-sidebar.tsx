"use client";

import { Boxes, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { SidebarNav } from "./sidebar-nav";

type MobileSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Close sidebar menu"
        onClick={() => onOpenChange(false)}
        onTouchStart={(event) => { event.preventDefault(); onOpenChange(false); }}
      />

      <aside className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[88vw] flex-col overflow-hidden border-r bg-card text-card-foreground shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-none">{siteConfig.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{siteConfig.company}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
            onTouchStart={(event) => { event.preventDefault(); onOpenChange(false); }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </div>

        <div className="shrink-0 border-t p-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">Need help?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link this area to support, docs, or your internal knowledge base.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
