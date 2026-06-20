"use client";

import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
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

          <RecordViewSheetSection padding="relaxed">
            <RolePermissionsEditor
              permissions={role.permissions}
              readOnly
              showPermissionValues={false}
              defaultExpanded={false}
            />
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
