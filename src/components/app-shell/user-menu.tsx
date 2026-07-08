"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, KeyRound, LogOut, Settings, UserCircle } from "lucide-react";

import { ChangePasswordDialog } from "@/components/configuration/change-password-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
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
  const { t } = useTranslation();
  const { displayName, email, role, roleLoading, signOut } = useAuth();
  const currentUserQuery = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const profileName =
    currentUserQuery.data?.name?.trim() ||
    displayName?.trim() ||
    email?.split("@")[0] ||
    t("shell.profileMenu.defaultUser");
  const profileEmail = currentUserQuery.data?.email?.trim() || email?.trim() || null;
  const profileRole = roleLoading ? t("common.loading") : role?.trim() || null;
  const initials = getInitials(currentUserQuery.data?.name ?? displayName, profileEmail);

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
        aria-label={t("shell.userMenu.open")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
          {initials}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-none">{profileName}</p>
          {profileRole ? (
            <p className="mt-1 text-xs text-muted-foreground">{profileRole}</p>
          ) : null}
        </div>
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-[220] w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
          <div className="m-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profileName}</p>
                {profileEmail ? (
                  <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>
                ) : null}
                {profileRole ? (
                  <p className="truncate text-xs text-muted-foreground">{profileRole}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-0.5 px-2 pb-2">
            <Link
              href="/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <UserCircle className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.account")}
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.settings")}
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.notifications")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setChangePasswordOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.changePassword")}
            </button>
          </div>

          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.logOut")}
            </button>
          </div>
        </div>
      ) : null}

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
