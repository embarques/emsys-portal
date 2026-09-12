"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, ScrollText } from "lucide-react";

import { WorkspaceNavLink } from "@/components/app-shell/workspace-nav-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import {
  getSeenNotificationIds,
  markNotificationsSeen,
} from "@/lib/notifications/seen-store";
import {
  useTopbarNotifications,
  type NotificationItem,
} from "@/lib/notifications/hooks/use-topbar-notifications";
import { cn } from "@/lib/utils";

function formatNotificationWhen(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function notificationTitle(item: NotificationItem, t: (key: string, values?: Record<string, string>) => string) {
  if (item.kind === "rare-activity") {
    return item.activity.description.trim() || t("shell.notifications.rareActivityFallback");
  }
  return t("shell.notifications.outstandingCheckTitle", {
    number: item.check.checkNumber.trim() || item.check.id,
  });
}

function notificationDetail(item: NotificationItem, t: (key: string, values?: Record<string, string>) => string) {
  if (item.kind === "rare-activity") {
    const user = item.activity.user.name.trim();
    const origin = item.activity.origin.trim();
    return [user, origin].filter(Boolean).join(" · ") || t("shell.notifications.rareActivity");
  }
  const invoice = item.check.invoice.number.trim();
  return invoice
    ? t("shell.notifications.outstandingCheckInvoice", { invoice })
    : t("shell.notifications.outstandingCheck");
}

export function NotificationsMenu() {
  const { locale, t } = useTranslation();
  const { items, isLoading } = useTopbarNotifications();
  const [seenIds, setSeenIds] = useState(() => getSeenNotificationIds());
  const [open, setOpen] = useState(false);

  const unseenCount = useMemo(
    () => items.reduce((count, item) => (seenIds.has(item.id) ? count : count + 1), 0),
    [items, seenIds],
  );

  function handleOpenChange(next: boolean) {
    if (open && !next) {
      const ids = items.map((item) => item.id);
      markNotificationsSeen(ids);
      setSeenIds(getSeenNotificationIds());
    }
    setOpen(next);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("shell.topbar.notifications")}
              className="relative shrink-0"
            >
              <Bell className="h-4 w-4" />
              {unseenCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
                  {unseenCount > 99 ? "99+" : unseenCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("shell.topbar.notifications")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-4 py-3">
          {t("shell.notifications.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto p-1">
          {isLoading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("shell.notifications.loading")}
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("shell.notifications.empty")}
            </p>
          ) : (
            items.map((item) => {
              const Icon = item.kind === "rare-activity" ? AlertTriangle : ScrollText;
              const unseen = !seenIds.has(item.id);
              return (
                <WorkspaceNavLink
                  key={item.id}
                  href={item.href}
                  label={notificationTitle(item, t)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    unseen && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.kind === "rare-activity"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{notificationTitle(item, t)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {notificationDetail(item, t)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatNotificationWhen(item.createdAt, locale)}
                    </p>
                  </div>
                  {unseen ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                  ) : null}
                </WorkspaceNavLink>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
