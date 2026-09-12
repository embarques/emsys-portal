"use client";

import { UserPlus } from "lucide-react";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";

type EntityFieldActionsProps = {
  hasSelection: boolean;
  onAdd: () => void;
  onEdit: () => void;
  disabled?: boolean;
};

/** @deprecated Prefer `FieldEntityActions` from `@/components/forms/field-entity-actions`. */
export function EntityFieldActions({ hasSelection, onAdd, onEdit, disabled }: EntityFieldActionsProps) {
  return (
    <FieldEntityActions
      hasSelection={hasSelection}
      onAdd={onAdd}
      onEdit={onEdit}
      addIcon={UserPlus}
      disabled={disabled}
    />
  );
}
