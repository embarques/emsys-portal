"use client";

import { Check, Edit, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatUserBranchLabel,
  getUserActiveBadgeClass,
  getUserBranchBadgeClass,
  getUserRoleBadgeClass,
  getUserRoleLabel,
} from "@/lib/users/display";
import type { User } from "@/lib/users/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type UserMobileRowProps = {
  user: User;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (user: User) => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onToggleSelected: (userId: string, checked: boolean) => void;
};

function userInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "-";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function UserMobileRow({
  user,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDeactivate,
  onToggleSelected,
}: UserMobileRowProps) {
  const { t } = useTranslation();
  const userId = String(user.id);

  function handleOpen() {
    if (selectionMode) {
      onToggleSelected(userId, !selected);
      return;
    }
    onOpen(user);
  }

  return (
    <article className={cn("border-b border-border/80 py-5 last:border-b-0", selected && "bg-primary/5")}>
      <div className="grid min-w-0 grid-cols-[2.25rem_3.75rem_minmax(0,1fr)_auto] gap-3">
        <button
          type="button"
          className={cn(
            "mt-1 flex size-7 items-center justify-center rounded-full border text-primary",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
          )}
          onClick={() => onToggleSelected(userId, !selected)}
          aria-label={selected ? "Deselect user" : "Select user"}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
          onClick={handleOpen}
        >
          {userInitials(user.name, user.email)}
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{user.name}</span>
          <span className="mt-1 block truncate text-base text-muted-foreground">{user.email}</span>
          <span className="mt-2 flex flex-wrap gap-2">
            <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", getUserRoleBadgeClass(user.role.name))}>
              {getUserRoleLabel(user.role.name)}
            </Badge>
            <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", getUserBranchBadgeClass(user))}>
              {formatUserBranchLabel(user)}
            </Badge>
          </span>
        </button>

        <button type="button" className="shrink-0 text-right" onClick={handleOpen}>
          <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", getUserActiveBadgeClass(user.active))}>
            {user.active ? t("users.enums.status.active") : t("users.enums.status.inactive")}
          </Badge>
        </button>
      </div>

      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(user)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          onClick={() => onDeactivate(user)}
        >
          <UserX className="size-4" />
          {t("users.view.deactivate")}
        </Button>
      </div>
    </article>
  );
}
