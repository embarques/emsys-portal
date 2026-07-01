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
import type { User } from "@/lib/users/types";

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

export function UserViewSheet({ user, open, onOpenChange, onEdit, onDelete }: Props) {
  if (!user) return null;
  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={user.name}
          description={user.email}
          meta={<><Badge className={getUserRoleBadgeClass(user.role.name)}>{getUserRoleLabel(user.role.name)}</Badge><Badge className={getUserActiveBadgeClass(user.active)}>{getUserActiveLabel(user.active)}</Badge></>}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title="Profile">
            <RecordViewSheetDetailRow label="User ID" value={truncateUserId(user.id)} />
            <RecordViewSheetDetailRow label="Firebase UID" value={user.uid ? truncateUid(user.uid) : "—"} />
            <RecordViewSheetDetailRow label="Name" value={user.name} />
            <RecordViewSheetDetailRow label="Email" value={user.email} />
            <RecordViewSheetDetailRow label="Status" value={getUserActiveLabel(user.active)} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title="Access">
            <RecordViewSheetDetailRow label="Role" value={user.role.name || "—"} />
            <RecordViewSheetDetailRow label="Branch" value={<Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title="Login hours">
            <RecordViewSheetDetailRow label="Start time" value={user.startTime || "Not restricted"} />
            <RecordViewSheetDetailRow label="End time" value={user.endTime || "Not restricted"} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow label="Created" value={user.createdAt ? formatAuditDate(user.createdAt) : "—"} />
            <RecordViewSheetDetailRow label="Created by" value={user.createdBy?.name || "—"} />
            <RecordViewSheetDetailRow label="Updated" value={user.updatedAt ? formatAuditDate(user.updatedAt) : "—"} />
            <RecordViewSheetDetailRow label="Updated by" value={user.updatedBy?.name || "—"} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <RecordViewSheetActions editLabel="Edit user" deleteLabel="Deactivate" onEdit={() => onEdit(user)} onDelete={user.active ? () => onDelete(user) : undefined} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
