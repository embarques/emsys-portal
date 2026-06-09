"use client";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
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

export function RoleViewSheet({ role, open, onOpenChange, onEdit, onDelete }: RoleViewSheetProps) {
  if (!role) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={role.name}
          description={`${role.permissions.length} permissions assigned`}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Role">
            <RecordViewSheetDetailRow label="Role ID" value={truncateRoleId(role.roleId)} />
            <RecordViewSheetDetailRow label="Role name" value={role.name} />
            <RecordViewSheetDetailRow label="Permission count" value={role.permissions.length} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Permissions" padding="relaxed">
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <Badge key={permission.id} variant="secondary" className="max-w-full whitespace-normal text-left">
                  <span className="font-mono text-[11px]">{permission.value}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>{getPermissionLabel(permission.value)}</span>
                </Badge>
              ))}
            </div>
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(role.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={role.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(role.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit role" onEdit={() => onEdit(role)} onDelete={() => onDelete(role)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
