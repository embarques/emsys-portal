"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }

  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }

  return "U";
}

export function UserMenu() {
  const router = useRouter();
  const { displayName, email, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = getInitials(displayName, email);
  const username = email?.split("@")[0] ?? "user";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.replace("/login");
  };

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
          <p className="text-sm font-medium leading-none">{displayName ?? username}</p>
          <p className="mt-1 text-xs text-muted-foreground">@{username}</p>
        </div>
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-[220] w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b p-4">
            <p className="text-sm font-semibold">{displayName ?? username}</p>
            <p className="mt-1 text-xs text-muted-foreground">{email ?? `@${username}`}</p>
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
              onClick={() => void handleSignOut()}
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
