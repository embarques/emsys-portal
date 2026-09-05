"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronUp,
  KeyRound,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";

import { ChangePasswordDialog } from "@/components/configuration/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const showEmail =
    email !== null &&
    displayName.toLowerCase() !== email.toLowerCase() &&
    displayName.toLowerCase() !== emailLocalPart;

  return { displayName, email, showEmail };
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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const rawProfileName =
    currentUserQuery.data?.name?.trim() ||
    displayName?.trim() ||
    email?.split("@")[0] ||
    null;
  const profileEmail = currentUserQuery.data?.email?.trim() || email?.trim() || null;
  const { displayName: profileName, showEmail } = resolveProfileIdentity(
    rawProfileName,
    profileEmail,
    t("shell.profileMenu.defaultUser"),
  );
  const profileRole = roleLoading ? t("common.loading") : role?.trim() || null;
  const initials = getProfileInitials(rawProfileName ?? profileName, profileEmail);
  const triggerSubtitle = profileRole ?? (showEmail ? profileEmail : null);

  function ProfileAvatar({ size = "default" }: { size?: "default" | "compact" }) {
    return (
      <Avatar
        className={cn(
          "shrink-0 border border-primary/15 bg-primary/10",
          size === "compact" ? "h-10 w-10" : "h-9 w-9",
        )}
      >
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  function ProfileMeta({
    emphasized = false,
    variant = "summary",
  }: {
    emphasized?: boolean;
    variant?: "summary" | "details";
  }) {
    const nameClassName = emphasized
      ? "truncate text-sm font-semibold leading-tight"
      : "truncate text-sm font-medium leading-tight text-foreground";
    const subtitle = variant === "summary" ? triggerSubtitle : null;

    return (
      <div className="min-w-0 flex-1">
        <p className={nameClassName}>{profileName}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {variant === "details" && profileEmail ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{profileEmail}</p>
        ) : null}
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

  const profileTrigger = (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={t("shell.profileMenu.open")}
      onClick={() => setOpen((current) => !current)}
      className={cn(
        "text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        compact
          ? "flex h-12 w-12 items-center justify-center rounded-xl hover:bg-accent/60"
          : cn(
              "flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 hover:bg-accent/50",
              open && "border-border bg-accent/40",
            ),
      )}
    >
      <ProfileAvatar size={compact ? "compact" : "default"} />
      {!compact ? (
        <>
          <div className="min-w-0 flex-1">
            <ProfileMeta variant="summary" />
          </div>
          <ChevronUp
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform",
              open && "rotate-180 text-muted-foreground",
            )}
            aria-hidden
          />
        </>
      ) : null}
    </button>
  );

  return (
    <div ref={menuRef} className="relative">
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {profileTrigger}
          </TooltipTrigger>
          <TooltipContent hidden={open} side="right" sideOffset={8}>
            {profileName}
          </TooltipContent>
        </Tooltip>
      ) : (
        profileTrigger
      )}

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[70] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl",
            compact ? "bottom-0 left-full ml-3 w-64" : "bottom-full left-0 right-0 mb-2",
          )}
        >
          <div className="border-b px-3 py-3">
            <div className="flex items-start gap-3">
              <ProfileAvatar />
              <ProfileMeta emphasized variant="details" />
              {profileRole ? (
                <span className="inline-flex shrink-0 max-w-[45%] truncate rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {profileRole}
                </span>
              ) : null}
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
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
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

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
