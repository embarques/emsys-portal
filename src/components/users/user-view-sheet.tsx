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

export function UserViewSheet({ user, open, onOpenChange, onEdit, onDelete }: UserViewSheetProps) {
  if (!user) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={user.name}
          description={`@${user.username}`}
          meta={
            <>
              <Badge className={getUserRoleBadgeClass(user.roleName)}>{getUserRoleLabel(user.roleName)}</Badge>
              <Badge className={getUserStatusBadgeClass(user.status)}>{getUserStatusLabel(user.status)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Account">
            <RecordViewSheetDetailRow label="User ID" value={truncateUserId(user.userId)} />
            <RecordViewSheetDetailRow label="Firebase UID" value={user.uid ? truncateUid(user.uid) : "—"} />
            <RecordViewSheetDetailRow label="Username" value={user.username} />
            <RecordViewSheetDetailRow label="Password" value={maskPassword(user.password)} />
            <RecordViewSheetDetailRow label="Name" value={user.name} />
            <RecordViewSheetDetailRow label="Role" value={getUserRoleLabel(user.roleName)} />
            <RecordViewSheetDetailRow label="Status" value={getUserStatusLabel(user.status)} />
            <RecordViewSheetDetailRow label="Language" value={getUserLanguageLabel(user.language)} />
            <RecordViewSheetDetailRow
              label="Branch"
              value={
                <Badge className={getUserBranchBadgeClass(user.branch)}>{formatUserBranchLabel(user)}</Badge>
              }
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="Email" value={user.email || "—"} />
            <RecordViewSheetDetailRow label="Phone" value={user.phone || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(user.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={user.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(user.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit user" onEdit={() => onEdit(user)} onDelete={() => onDelete(user)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
