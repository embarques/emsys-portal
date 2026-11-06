import type { ChangeResource, NewChange, TargetContext } from "../api";
import { changeRequestFormSchema, type ChangeRequestFormValues } from "../schemas/change-request.schema";

/** A permission for another record/resource, or a missing action, never permits submission. */
export function canRequestChange(
  target: TargetContext | null | undefined,
  resource: ChangeResource,
  id: string,
  action: "UPDATE" | "VOID",
): boolean {
  return Boolean(target && target.resourceType === resource && target.resourceId === id &&
    typeof target.version === "string" && target.version.trim() &&
    target.allowedActions?.[action === "UPDATE" ? "request_update" : "request_void"] === true);
}

export function buildChangeCommand(values: ChangeRequestFormValues, target: TargetContext, requestId: string): NewChange {
  const parsed = changeRequestFormSchema.parse(values);
  if (!canRequestChange(target, parsed.resourceType, parsed.resourceId, parsed.action)) {
    throw new Error("Verify access to this record again before submitting.");
  }
  const command: NewChange = {
    requestId,
    resourceType: parsed.resourceType,
    resourceId: parsed.resourceId,
    action: parsed.action,
    expectedVersion: target.version,
    reason: parsed.reason,
  };
  if (parsed.action === "VOID") return command;
  const field = parsed.resourceType === "pickup" ? "purpose" : parsed.resourceType === "inventory" ? "notes" : "description";
  command.proposedChanges = parsed.resourceType === "invoice"
    ? { receiver: { name: parsed.text } }
    : { [field]: parsed.text };
  if (parsed.resourceType === "journal" && parsed.amount.trim()) {
    command.proposedChanges.amount = Number(parsed.amount);
  }
  return command;
}

