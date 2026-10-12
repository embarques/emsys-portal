"use client";

import { Check, Edit, Eye, MoreHorizontal, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatAuditDateTime } from "@/lib/audit/display";
import { getUserActiveBadgeClass } from "@/lib/users/display";
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

export function UserMobileRow({ user, selected, selectionMode, onOpen, onEdit, onDeactivate, onToggleSelected }: UserMobileRowProps) {
  const { t } = useTranslation();
  const name = user.name || user.email || `#${user.id}`;
  const selectLabel = t(selected ? "users.actions.deselect" : "users.actions.select", { name });
  const details = [
    [t("users.view.userId"), String(user.id)],
    [t("users.view.startTime"), user.startTime.trim()],
    [t("users.view.endTime"), user.endTime.trim()],
    [t("users.view.created"), user.createdAt ? formatAuditDateTime(user.createdAt) : ""],
    [t("users.view.createdBy"), user.createdBy?.name],
    [t("users.view.updated"), user.updatedAt ? formatAuditDateTime(user.updatedAt) : ""],
    [t("users.view.updatedBy"), user.updatedBy?.name],
  ].filter(([, value]) => value);
  const fields = [
    [t("users.view.email"), user.email],
    [t("users.view.role"), user.role.name],
    [t("users.view.branch"), user.branch.name],
  ].filter(([, value]) => value);

  return (
    <article className={cn("min-w-0 border-b border-border py-4 last:border-b-0", selected && "bg-primary/5")}>
      <div className="flex items-start gap-2">
        {selectionMode ? (
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" role="checkbox" aria-checked={selected} aria-label={selectLabel} onClick={() => onToggleSelected(String(user.id), !selected)}>
            <span className={cn("flex size-5 items-center justify-center rounded border", selected && "border-primary bg-primary text-primary-foreground")}>
              {selected ? <Check className="size-4" /> : null}
            </span>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" className="block w-full break-words text-left text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]" onClick={() => selectionMode ? onToggleSelected(String(user.id), !selected) : onOpen(user)}>{name}</button>
          <Badge className={cn("mt-1 text-xs", getUserActiveBadgeClass(user.active))}>{t(user.active ? "users.enums.status.active" : "users.enums.status.inactive")}</Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("users.table.actionsFor", { name })} title={t("users.table.actionsFor", { name })}><MoreHorizontal className="size-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(user)}><Eye className="size-4" />{t("users.actions.details")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(user)}><Edit className="size-4" />{t("common.actions.edit")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleSelected(String(user.id), !selected)}><Check className="size-4" />{selectLabel}</DropdownMenuItem>
            {user.active ? <DropdownMenuItem className="text-destructive" onSelect={() => onDeactivate(user)}><UserX className="size-4" />{t("users.view.deactivate")}</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {fields.length ? <dl className="mt-3 grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {fields.map(([label, value]) => <div className="contents" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd></div>)}
      </dl> : null}
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer content-center text-muted-foreground">{t("users.actions.details")}</summary>
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-x-3 gap-y-2 pb-2">
          {details.map(([label, value]) => <div className="contents" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="[overflow-wrap:anywhere]">{value}</dd></div>)}
        </dl>
      </details>
    </article>
  );
}
