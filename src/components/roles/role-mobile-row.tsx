"use client";

import { Check, Edit, Shield, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPermissionsSummary, truncateRoleId } from "@/lib/roles/display";
import type { Role } from "@/lib/roles/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type RoleMobileRowProps = {
  role: Role;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (role: Role) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onToggleSelected: (roleId: string, checked: boolean) => void;
};

export function RoleMobileRow({
  role,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDelete,
  onToggleSelected,
}: RoleMobileRowProps) {
  const { t } = useTranslation();

  function handleOpen() {
    if (selectionMode) {
      onToggleSelected(role.roleId, !selected);
      return;
    }
    onOpen(role);
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
          onClick={() => onToggleSelected(role.roleId, !selected)}
          aria-label={selected ? "Deselect role" : "Select role"}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          onClick={handleOpen}
        >
          <Shield className="size-6" />
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{role.name}</span>
          <span className="mt-1 block font-mono text-sm text-muted-foreground">{truncateRoleId(role.roleId)}</span>
          <span className="mt-2 block line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
            {formatPermissionsSummary(role, 4)}
          </span>
        </button>

        <button type="button" className="shrink-0 text-right" onClick={handleOpen}>
          <Badge className="rounded-full border-transparent bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {t("roles.table.permissionsCount", { count: role.permissions.length })}
          </Badge>
          {role.systemRole ? (
            <span className="mt-2 block text-xs font-semibold text-muted-foreground">{t("roles.table.systemRole")}</span>
          ) : null}
        </button>
      </div>

      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(role)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          disabled={role.systemRole}
          onClick={() => onDelete(role)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}
