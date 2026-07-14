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
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import {
  formatUserBranchLabel,
  getUserActiveBadgeClass,
  getUserBranchBadgeClass,
  getUserRoleBadgeClass,
  getUserRoleLabel,
  truncateUid,
  truncateUserId,
} from "@/lib/users/display";
import { useUserLabels } from "@/lib/users/hooks/use-user-labels";
import type { User } from "@/lib/users/types";

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

export function UserViewSheet({ user, open, onOpenChange, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const userLabels = useUserLabels();

  if (!user) return null;

  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={user.name}
          description={user.email}
          meta={
            <>
              <Badge className={getUserRoleBadgeClass(user.role.name)}>
                {getUserRoleLabel(user.role.name)}
              </Badge>
              <Badge className={getUserActiveBadgeClass(user.active)}>
                {userLabels.active(user.active)}
              </Badge>
            </>
          }
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("users.view.sections.profile")}>
            <RecordViewSheetDetailRow label={t("users.view.userId")} value={truncateUserId(user.id)} />
            <RecordViewSheetDetailRow
              label={t("users.view.firebaseUid")}
              value={user.uid ? truncateUid(user.uid) : dash}
            />
            <RecordViewSheetDetailRow label={t("users.view.name")} value={user.name} />
            <RecordViewSheetDetailRow label={t("users.view.email")} value={user.email} />
            <RecordViewSheetDetailRow
              label={t("users.view.status")}
              value={userLabels.active(user.active)}
            />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("users.view.sections.access")}>
            <RecordViewSheetDetailRow label={t("users.view.role")} value={user.role.name || dash} />
            <RecordViewSheetDetailRow
              label={t("users.view.branch")}
              value={
                <Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>
              }
            />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("users.view.sections.loginHours")}>
            <RecordViewSheetDetailRow
              label={t("users.view.startTime")}
              value={user.startTime || t("users.view.notRestricted")}
            />
            <RecordViewSheetDetailRow
              label={t("users.view.endTime")}
              value={user.endTime || t("users.view.notRestricted")}
            />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("users.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("users.view.created")}
              value={user.createdAt ? formatAuditDateTime(user.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("users.view.createdBy")}
              value={user.createdBy?.name || dash}
            />
            <RecordViewSheetDetailRow
              label={t("users.view.updated")}
              value={user.updatedAt ? formatAuditDateTime(user.updatedAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("users.view.updatedBy")}
              value={user.updatedBy?.name || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
        <RecordViewSheetActions
          editLabel={t("users.view.edit")}
          deleteLabel={t("users.view.deactivate")}
          onEdit={() => onEdit(user)}
          onDelete={user.active ? () => onDelete(user) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
