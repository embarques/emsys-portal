type WorkflowWrite = {
  resource: string;
  action?: string;
  update?: boolean;
  version?: number;
  idempotencyKey: string;
};

/** Swagger requires a version for draft PATCH, posting and cancellation. */
export function workflowWriteHeaders(input: WorkflowWrite): Record<string, string> {
  const draftCommand = ['receipts', 'dispatches'].includes(input.resource)
    && ['post', 'cancel'].includes(input.action ?? '');
  if ((input.update || draftCommand) && (!Number.isSafeInteger(input.version) || Number(input.version) < 1)) {
    throw new Error('Reload this record to obtain its current version before saving, posting or cancelling.');
  }
  const headers: Record<string, string> = { 'Idempotency-Key': input.idempotencyKey };
  if (input.version !== undefined) headers['If-Match'] = String(input.version);
  return headers;
}
