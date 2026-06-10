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
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import {
  formatUserBranchLabel,
  getUserActiveBadgeClass,
  getUserActiveLabel,
  getUserBranchBadgeClass,
  getUserRoleBadgeClass,
  getUserRoleLabel,
  truncateUid,
  truncateUserId,
} from "@/lib/users/display";
import { maskPassword, type User } from "@/lib/users/types";

type UserViewSheetProps = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

export function UserViewSheet({ user, open, onOpenChange, onEdit, onDelete }: UserViewSheetProps) {
  if (!user) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={user.fullName || user.userName}
          description={`@${user.userName}`}
          meta={
            <>
              <Badge className={getUserRoleBadgeClass(user.role.name)}>{getUserRoleLabel(user.role.name)}</Badge>
              <Badge className={getUserActiveBadgeClass(user.active)}>{getUserActiveLabel(user.active)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Account">
            <RecordViewSheetDetailRow label="User ID" value={truncateUserId(user.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("uid")} value={user.uid ? truncateUid(user.uid) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("userName")} value={user.userName} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("password")} value={maskPassword(user.password)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("fullName")} value={user.fullName || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("active")} value={getUserActiveLabel(user.active)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("type")} value={user.type || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("accessCode")} value={String(user.accessCode)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("user")} value={user.user || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Role">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("role.id")} value={user.role.id > 0 ? String(user.role.id) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("role.name")} value={getUserRoleLabel(user.role.name)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("role.active")} value={getUserActiveLabel(user.role.active)} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("role.permissions")}
              value={user.role.permissions.length > 0 ? String(user.role.permissions.length) : "—"}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.id")} value={user.branch.id > 0 ? String(user.branch.id) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.name")} value={user.branch.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.code")} value={user.branch.code || "—"} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("branch")}
              value={
                <Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>
              }
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Schedule">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("startTime")} value={user.startTime || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("endTime")} value={user.endTime || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("email")} value={user.email || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("createdAt")}
              value={user.createdAt ? formatAuditDate(user.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("updatedAt")}
              value={user.updatedAt ? formatAuditDate(user.updatedAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("role.createdAt")}
              value={user.role.createdAt ? formatAuditDate(user.role.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("role.updatedAt")}
              value={user.role.updatedAt ? formatAuditDate(user.role.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit user" onEdit={() => onEdit(user)} onDelete={() => onDelete(user)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
