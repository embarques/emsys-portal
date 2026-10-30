import { normalizeApiError } from "@/lib/api/axios";

export type VersionedRecord = { id: string; version?: string };

export function mutationVersionHeaders(version?: string): Record<string, string> {
  if (!version || !/^v1:[0-9a-f]{64}$/.test(version)) {
    throw new Error("This record has no valid saved version. Reopen it before editing; your current input has been kept.");
  }
  return { "If-Match": `"${version}"` };
}

export function isStaleMutation(error: unknown): boolean {
  const { status } = normalizeApiError(error);
  return status === 412 || status === 428;
}
