export type WorkflowWriteMethod = 'post' | 'patch' | 'put' | 'delete';

type WorkflowWrite = {
  method: WorkflowWriteMethod;
  /** Swagger requires `If-Match` for draft updates and most state commands. */
  versioned: boolean;
  version?: number;
  idempotencyKey: string;
};

export const VERSION_REQUIRED_ERROR = 'inventory.operations.errors.versionRequired';

export function isWorkflowVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 0;
}

/** Builds `If-Match` / `Idempotency-Key` headers; fails closed when a required version is missing. */
export function workflowWriteHeaders(input: WorkflowWrite): Record<string, string> {
  if (input.versioned && !isWorkflowVersion(input.version)) {
    throw new Error(VERSION_REQUIRED_ERROR);
  }
  const headers: Record<string, string> = {};
  if (input.method === 'post' || input.method === 'delete') headers['Idempotency-Key'] = input.idempotencyKey;
  if (input.versioned) headers['If-Match'] = String(input.version);
  return headers;
}
