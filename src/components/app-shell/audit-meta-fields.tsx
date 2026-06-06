"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuditDate } from "@/lib/audit/display";

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
  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="createdBy">User created</Label>
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
            <Label htmlFor="updatedAt">Date modified</Label>
            <Input id="updatedAt" value={formatAuditDate(updatedAt)} readOnly className="bg-muted/40" />
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <p className="text-xs text-muted-foreground">
          Date created is preserved from the original record. Date modified updates automatically when you save.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Date created and date modified are recorded automatically when you save.
        </p>
      )}
    </div>
  );
}
