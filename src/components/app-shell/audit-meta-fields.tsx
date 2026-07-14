"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";

type AuditMetaFieldsProps = {
  createdBy: string;
  isEditing?: boolean;
  updatedAt?: string;
  onCreatedByChange?: (value: string) => void;
};

export function AuditMetaFields({
  createdBy,
  isEditing = false,
  updatedAt,
  onCreatedByChange,
}: AuditMetaFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="createdBy">{t("common.audit.createdBy")}</Label>
          <Input
            id="createdBy"
            value={createdBy}
            readOnly={isEditing}
            onChange={(event) => onCreatedByChange?.(event.target.value)}
            className={isEditing ? "bg-muted/40" : undefined}
          />
        </div>
        {isEditing && updatedAt ? (
          <div className="space-y-2">
            <Label htmlFor="updatedAt">{t("common.audit.updatedAt")}</Label>
            <Input id="updatedAt" value={formatAuditDateTime(updatedAt)} readOnly className="bg-muted/40" />
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <p className="text-xs text-muted-foreground">{t("common.audit.helpEditing")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("common.audit.helpCreating")}</p>
      )}
    </div>
  );
}
