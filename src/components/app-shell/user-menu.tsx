"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDisplayNameInitials } from "@/lib/configuration/types";
import { useConfigurationStore } from "@/lib/configuration/use-configuration";

export function UserMenu() {
  const configuration = useConfigurationStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = getDisplayNameInitials(configuration.displayName);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="relative h-10 gap-2 rounded-full px-2 sm:rounded-lg sm:pr-3"
        aria-label="Open user menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-none">{configuration.displayName}</p>
          <p className="mt-1 text-xs text-muted-foreground">@{configuration.username}</p>
        </div>
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-[220] w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b p-4">
            <p className="text-sm font-semibold">{configuration.displayName}</p>
            <p className="mt-1 text-xs text-muted-foreground">@{configuration.username}</p>
          </div>

          <div className="p-2">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-4 w-4" />
              Configuration
            </Link>
            <Link
              href="/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <UserCircle className="h-4 w-4" />
              Account
            </Link>
          </div>

          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
