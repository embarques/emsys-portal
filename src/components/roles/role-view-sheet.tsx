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
import { getPermissionLabel } from "@/lib/roles/permissions-catalog";
import { truncateRoleId } from "@/lib/roles/display";
import type { Role } from "@/lib/roles/types";

type RoleViewSheetProps = {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function RoleViewSheet({ role, open, onOpenChange, onEdit, onDelete }: RoleViewSheetProps) {
  if (!role) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{role.name}</SheetTitle>
          <SheetDescription>{role.permissions.length} permissions assigned</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Role ID" value={truncateRoleId(role.roleId)} />
            <DetailRow label="Role name" value={role.name} />
            <DetailRow label="Permission count" value={role.permissions.length} />
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium">Permissions</p>
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <Badge key={permission.id} variant="secondary" className="max-w-full whitespace-normal text-left">
                  <span className="font-mono text-[11px]">{permission.value}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>{getPermissionLabel(permission.value)}</span>
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Date created" value={formatAuditDate(role.createdAt)} />
            <DetailRow label="User created" value={role.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(role.updatedAt)} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(role)}>
              <Pencil className="h-4 w-4" />
              Edit role
            </Button>
            <Button variant="destructive" onClick={() => onDelete(role)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
