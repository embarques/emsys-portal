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
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { truncateRoleId } from "@/lib/roles/display";
import type { PermissionCatalogEntry } from "@/lib/roles/permissions-catalog";
import type { Role } from "@/lib/roles/types";

type RoleViewSheetProps = {
  role: Role | null;
  permissionCatalog: PermissionCatalogEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
};

export function RoleViewSheet({
  role,
  permissionCatalog,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: RoleViewSheetProps) {
  const { t } = useTranslation();

  if (!role) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={role.name}
          description={t("roles.view.permissionsAssigned", { count: role.permissions.length })}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("roles.view.sections.role")}>
            <RecordViewSheetDetailRow label={t("roles.view.roleId")} value={truncateRoleId(role.roleId)} />
            <RecordViewSheetDetailRow label={t("roles.view.roleName")} value={role.name} />
            <RecordViewSheetDetailRow
              label={t("roles.view.permissionCount")}
              value={role.permissions.length}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection padding="relaxed">
            <RolePermissionsEditor
              permissions={role.permissions}
              catalog={permissionCatalog}
              readOnly
              showPermissionValues={false}
              defaultExpanded={false}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("roles.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("roles.columns.createdAt")}
              value={formatAuditDateTime(role.createdAt)}
            />
            <RecordViewSheetDetailRow
              label={t("roles.columns.createdBy")}
              value={role.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("roles.columns.updatedAt")}
              value={formatAuditDateTime(role.updatedAt)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("roles.view.edit")}
          deleteLabel={t("common.actions.delete")}
          onEdit={() => onEdit(role)}
          onDelete={() => onDelete(role)}
          deleteDisabled={role.systemRole}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
