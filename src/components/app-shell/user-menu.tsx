"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, KeyRound, LogOut, Settings, UserCircle } from "lucide-react";

import { ChangePasswordDialog } from "@/components/configuration/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function resolveProfileIdentity(
  rawName: string | null | undefined,
  rawEmail: string | null | undefined,
  defaultUserLabel: string,
) {
  const email = rawEmail?.trim() || null;
  let name = rawName?.trim() || null;

  if (!name && email) {
    name = email.split("@")[0] || defaultUserLabel;
  }

  if (!name) {
    name = defaultUserLabel;
  }

  const emailLocalPart = email?.split("@")[0]?.toLowerCase() ?? null;
  const nameIsFullEmail = email !== null && name.toLowerCase() === email.toLowerCase();
  const displayName = nameIsFullEmail ? emailLocalPart ?? name : name;

  return { displayName, email };
}

export function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const { displayName, email, role, roleLoading, signOut } = useAuth();
  const currentUserQuery = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const rawProfileName =
    currentUserQuery.data?.name?.trim() ||
    displayName?.trim() ||
    email?.split("@")[0] ||
    null;
  const profileEmail = currentUserQuery.data?.email?.trim() || email?.trim() || null;
  const { displayName: profileName } = resolveProfileIdentity(
    rawProfileName,
    profileEmail,
    t("shell.profileMenu.defaultUser"),
  );
  const profileRole = roleLoading ? t("common.loading") : role?.trim() || null;
  const initials = getInitials(rawProfileName ?? profileName, profileEmail);

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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative h-10 gap-2 rounded-full px-2 sm:rounded-lg sm:pr-3"
            aria-label={t("shell.userMenu.open")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Avatar className="h-8 w-8 border border-primary/15 bg-primary/10">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight">{profileName}</p>
              {profileRole ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{profileRole}</p>
              ) : null}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("shell.userMenu.open")}</TooltipContent>
      </Tooltip>

      {open ? (
        <div className="absolute right-0 top-12 z-[220] w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b px-3 py-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9 border border-primary/15 bg-primary/10">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{profileName}</p>
                {profileEmail ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{profileEmail}</p>
                ) : null}
              </div>
              {profileRole ? (
                <span className="inline-flex shrink-0 max-w-[45%] truncate rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {profileRole}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-0.5 px-2 pb-2">
            <Link
              href="/settings"
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
