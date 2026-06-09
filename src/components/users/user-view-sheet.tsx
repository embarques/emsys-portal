"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAuditDate } from "@/lib/audit/display";
import {
  getUserBranchBadgeClass,
  getUserLanguageLabel,
  getUserRoleBadgeClass,
  getUserRoleLabel,
  getUserStatusBadgeClass,
  getUserStatusLabel,
  truncateUid,
  truncateUserId,
} from "@/lib/users/display";
import { formatUserBranchLabel, maskPassword, type User } from "@/lib/users/types";

type UserViewSheetProps = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function UserViewSheet({ user, open, onOpenChange, onEdit, onDelete }: UserViewSheetProps) {
  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{user.name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span>@{user.username}</span>
            <Badge className={getUserRoleBadgeClass(user.roleName)}>{getUserRoleLabel(user.roleName)}</Badge>
            <Badge className={getUserStatusBadgeClass(user.status)}>{getUserStatusLabel(user.status)}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="User ID" value={truncateUserId(user.userId)} />
            <DetailRow label="Firebase UID" value={user.uid ? truncateUid(user.uid) : "—"} />
            <DetailRow label="Username" value={user.username} />
            <DetailRow label="Password" value={maskPassword(user.password)} />
            <DetailRow label="Name" value={user.name} />
            <DetailRow label="Role" value={getUserRoleLabel(user.roleName)} />
            <DetailRow label="Status" value={getUserStatusLabel(user.status)} />
            <DetailRow label="Language" value={getUserLanguageLabel(user.language)} />
            <DetailRow
              label="Branch"
              value={
                <Badge className={getUserBranchBadgeClass(user.branch)}>
                  {formatUserBranchLabel(user)}
                </Badge>
              }
            />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Email" value={user.email || "—"} />
            <DetailRow label="Phone" value={user.phone || "—"} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Date created" value={formatAuditDate(user.createdAt)} />
            <DetailRow label="User created" value={user.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(user.updatedAt)} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(user)}>
              <Pencil className="h-4 w-4" />
              Edit user
            </Button>
            <Button variant="destructive" onClick={() => onDelete(user)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
