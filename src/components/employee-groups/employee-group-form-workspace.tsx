"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { EmployeeGroupFormFields } from "@/components/employee-groups/employee-group-form-fields";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployeeGroups } from "@/lib/employee-groups/hooks/use-employee-groups";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function EmployeeGroupFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  // Employee groups have no get-by-id endpoint; resolve the record from the list cache.
  const groupsQuery = useEmployeeGroups(200, { enabled: isEditing });
  const editing = isEditing
    ? (groupsQuery.data?.items.find((group) => group.id === entityId) ?? null)
    : null;

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, `Edit ${editing.name}`);
    }
  }, [editing?.name, isEditing, tabId, updateTabLabel]);

  if (isEditing && groupsQuery.isLoading) {
    return (
      <FormTabShell title="Edit employee group">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading employee group…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (groupsQuery.isError || !editing)) {
    const message = groupsQuery.isError
      ? normalizeApiError(groupsQuery.error).message
      : "This employee group could not be found.";
    return (
      <FormTabShell title="Edit employee group">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? "Edit employee group" : "Create employee group"}
      description={
        isEditing && editing ? editing.name : "Group employees into a crew for routing and reports."
      }
    >
      <EmployeeGroupFormFields
        key={isEditing ? (editing?.id ?? "edit") : "new"}
        group={editing}
        resetAfterCreate
        onCreated={(created) => notifyAdded("Employee group", created.name)}
        onUpdated={(updated) => {
          notifyUpdated("Employee group", updated.name);
          closeFormTabAndReturn(tabId);
        }}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
