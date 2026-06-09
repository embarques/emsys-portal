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
            <RecordViewSheetDetailRow label="id" value={truncateUserId(user.id)} />
            <RecordViewSheetDetailRow label="uid" value={user.uid ? truncateUid(user.uid) : "—"} />
            <RecordViewSheetDetailRow label="userName" value={user.userName} />
            <RecordViewSheetDetailRow label="password" value={maskPassword(user.password)} />
            <RecordViewSheetDetailRow label="fullName" value={user.fullName || "—"} />
            <RecordViewSheetDetailRow label="active" value={getUserActiveLabel(user.active)} />
            <RecordViewSheetDetailRow label="type" value={user.type || "—"} />
            <RecordViewSheetDetailRow label="accessCode" value={String(user.accessCode)} />
            <RecordViewSheetDetailRow label="user" value={user.user || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Role">
            <RecordViewSheetDetailRow label="role.id" value={user.role.id > 0 ? String(user.role.id) : "—"} />
            <RecordViewSheetDetailRow label="role.name" value={getUserRoleLabel(user.role.name)} />
            <RecordViewSheetDetailRow label="role.active" value={getUserActiveLabel(user.role.active)} />
            <RecordViewSheetDetailRow
              label="role.permissions"
              value={user.role.permissions.length > 0 ? String(user.role.permissions.length) : "—"}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label="branch.id" value={user.branch.id > 0 ? String(user.branch.id) : "—"} />
            <RecordViewSheetDetailRow label="branch.name" value={user.branch.name || "—"} />
            <RecordViewSheetDetailRow label="branch.code" value={user.branch.code || "—"} />
            <RecordViewSheetDetailRow
              label="branch"
              value={
                <Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>
              }
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Schedule">
            <RecordViewSheetDetailRow label="startTime" value={user.startTime || "—"} />
            <RecordViewSheetDetailRow label="endTime" value={user.endTime || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="email" value={user.email || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow
              label="createdAt"
              value={user.createdAt ? formatAuditDate(user.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="updatedAt"
              value={user.updatedAt ? formatAuditDate(user.updatedAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="role.createdAt"
              value={user.role.createdAt ? formatAuditDate(user.role.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="role.updatedAt"
              value={user.role.updatedAt ? formatAuditDate(user.role.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit user" onEdit={() => onEdit(user)} onDelete={() => onDelete(user)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
