"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

function getProfileInitials(displayName: string | null, email: string | null): string {
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

type SidebarProfileMenuProps = {
  compact?: boolean;
  onNavigate?: () => void;
};

export function SidebarProfileMenu({ compact = false, onNavigate }: SidebarProfileMenuProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { displayName, email, role, roleLoading, signOut } = useAuth();
  const currentUserQuery = useCurrentUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const profileName =
    currentUserQuery.data?.name?.trim() ||
    displayName?.trim() ||
    email?.split("@")[0] ||
    t("shell.profileMenu.defaultUser");
  const profileEmail = currentUserQuery.data?.email?.trim() || email?.trim() || null;
  const profileRole = roleLoading ? t("common.loading") : role?.trim() || null;
  const initials = getProfileInitials(currentUserQuery.data?.name ?? displayName, profileEmail);

  function ProfileMeta({ emphasized = false }: { emphasized?: boolean }) {
    const nameClassName = emphasized ? "truncate text-sm font-semibold" : "truncate text-sm font-medium text-foreground";
    const metaClassName = "truncate text-xs text-muted-foreground";

    return (
      <div className="min-w-0">
        <p className={nameClassName}>{profileName}</p>
        {profileEmail ? <p className={metaClassName}>{profileEmail}</p> : null}
        {profileRole ? <p className={metaClassName}>{profileRole}</p> : null}
      </div>
    );
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function closeMenu() {
    setOpen(false);
  }

  function handleNavigate() {
    closeMenu();
    onNavigate?.();
  }

  async function handleSignOut() {
    closeMenu();
    onNavigate?.();
    await signOut();
    router.replace("/login");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("shell.profileMenu.open")}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "rounded-xl bg-muted/60 text-left transition hover:bg-muted",
          compact
            ? "flex h-14 w-14 items-center justify-center"
            : "flex w-full items-center gap-3 p-3",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 font-bold text-primary",
            compact ? "h-10 w-10 text-sm" : "h-11 w-11 text-sm",
          )}
        >
          {initials}
        </div>
        {!compact ? (
          <>
            <div className="min-w-0 flex-1">
              <ProfileMeta />
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[70] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl",
            compact ? "bottom-0 left-full ml-3 w-64" : "bottom-full left-0 right-0 mb-2",
          )}
        >
          <div className="m-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-bold text-primary">
                {initials}
              </div>
              <ProfileMeta emphasized />
            </div>
          </div>

          <div className="space-y-0.5 px-2 pb-2">
            <Link
              href="/security"
              role="menuitem"
              onClick={handleNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <UserCircle className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.account")}
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={handleNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.settings")}
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={handleNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.notifications")}
            </Link>
          </div>

          <div className="border-t p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("shell.profileMenu.logOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
