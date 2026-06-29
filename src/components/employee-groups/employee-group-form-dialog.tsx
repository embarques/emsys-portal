"use client";

import { EmployeeGroupFormFields } from "@/components/employee-groups/employee-group-form-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";

type EmployeeGroupFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this group; otherwise it creates a new one. */
  group?: EmployeeGroupOption | null;
  onCreated?: (group: EmployeeGroupOption) => void;
  onUpdated?: (group: EmployeeGroupOption) => void;
};

export function EmployeeGroupFormDialog({
  open,
  onOpenChange,
  group,
  onCreated,
  onUpdated,
}: EmployeeGroupFormDialogProps) {
  const isEditing = Boolean(group);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>{isEditing ? "Edit employee group" : "Create employee group"}</DialogTitle>
        </DialogHeader>

        {open ? (
          <EmployeeGroupFormFields
            key={group?.id ?? "new"}
            group={group}
            onCreated={(created) => {
              onCreated?.(created);
              onOpenChange(false);
            }}
            onUpdated={(updated) => {
              onUpdated?.(updated);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
