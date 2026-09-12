"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  Command,
  FilePlus2,
  HandCoins,
  Search,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

type QuickActionId = "addTransaction" | "createAppointment" | "createCustomer" | "createInvoice";

type QuickActionDefinition = {
  id: QuickActionId;
  labelKey: string;
  icon: LucideIcon;
  permission: Permission;
};

const QUICK_ACTION_DEFINITIONS: QuickActionDefinition[] = [
  {
    id: "addTransaction",
    labelKey: "shell.search.addTransaction",
    icon: HandCoins,
    permission: PERMISSIONS.incomeView,
  },
  {
    id: "createAppointment",
    labelKey: "shell.search.createAppointment",
    icon: CalendarPlus,
    permission: PERMISSIONS.pickupsView,
  },
  {
    id: "createCustomer",
    labelKey: "shell.search.createCustomer.label",
    icon: UserPlus,
    permission: PERMISSIONS.clientsCreate,
  },
  {
    id: "createInvoice",
    labelKey: "shell.search.createInvoice",
    icon: FilePlus2,
    permission: PERMISSIONS.invoicesView,
  },
];

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SearchMenu() {
  const { locale, t } = useTranslation();
  const { hasPermission } = useAuth();
  const { notifyError } = useFeedback();
  const { openFormTab, openTab } = useWorkspaceTabs();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const currentUserQuery = useCurrentUser();
  const branchId = currentUserQuery.data?.branch.id ?? 0;
  const statementQuery = useIncomeStatement(branchId, todayDateValue());

  const actions = useMemo(() => {
    const visible = QUICK_ACTION_DEFINITIONS.filter((action) =>
      hasPermission(action.permission.name, action.permission.resourceType),
    ).map((action) => ({
      ...action,
      label: t(action.labelKey),
    }));

    return visible.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));
  }, [hasPermission, locale, t]);

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return actions;
    return actions.filter((action) => action.label.toLowerCase().includes(normalizedQuery));
  }, [actions, query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function runAction(id: QuickActionId) {
    setOpen(false);
    setQuery("");

    switch (id) {
      case "createCustomer":
        openFormTab({
          feature: "customers",
          baseHref: "/customers",
          mode: "add",
          label: t("shell.search.createCustomer.label"),
        });
        return;
      case "createAppointment":
        openFormTab({
          feature: "orders",
          baseHref: "/appointments",
          mode: "add",
          label: t("shell.search.createAppointment"),
        });
        return;
      case "createInvoice":
        openFormTab({
          feature: "invoices",
          baseHref: "/invoices",
          mode: "add",
          label: t("shell.search.createInvoice"),
        });
        return;
      case "addTransaction": {
        const statement = statementQuery.data;
        if (statement?.status === "OPEN") {
          openFormTab({
            feature: "daily-income-transactions",
            baseHref: "/accounting/daily-income",
            mode: "add",
            entityId: String(statement.id),
            label: t("shell.search.addTransaction"),
          });
          return;
        }

        notifyError(t("shell.search.addTransactionNeedsOpenCuadre"));
        openTab("/accounting/daily-income", t("navigation.items.dailyIncome"));
        return;
      }
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="hidden h-9 w-56 justify-start gap-2 px-3 text-muted-foreground sm:flex"
            aria-label={t("shell.search.openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <Command className="h-4 w-4" />
            <span className="text-sm">{t("shell.search.placeholder")}</span>
            <span className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("shell.search.openMenu")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="sm:hidden"
            aria-label={t("shell.search.openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Command className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("shell.search.openMenu")}</TooltipContent>
      </Tooltip>

      {open ? (
        <div
          className={cn(
            "fixed left-24 right-3 top-24 z-[230] max-h-[70dvh] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl",
            "sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[28rem] sm:max-w-[calc(100vw-2rem)]",
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={t("shell.search.inputPlaceholder")}
            />
          </div>

          <div className="p-2">
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("shell.search.quickActions")}
            </p>
            <div className="space-y-1">
              {filteredActions.length > 0 ? (
                filteredActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => runAction(action.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-none">{action.label}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("shell.search.noResults")}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
