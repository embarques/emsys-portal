import { workflowWriteHeaders } from '../utils/request-headers';
import { axiosInstance } from '@/lib/api/axios';
import { INVENTORY_WORKFLOW_ENDPOINTS } from '@/lib/api/endpoints';
import type { Envelope, Page, WorkflowRecord } from '../types/workflow';

export function workflowEndpoint(resource: string) {
  const endpoint = INVENTORY_WORKFLOW_ENDPOINTS[resource as keyof typeof INVENTORY_WORKFLOW_ENDPOINTS];
  if (!endpoint) throw new Error('Unknown inventory resource.');
  return endpoint;
}
export async function listWorkflow(resource: string, filters: Record<string, string>, cursor?: string): Promise<Page> {
  const response = await axiosInstance.get<Page>(workflowEndpoint(resource), { params: { ...filters, limit: 50, cursor } });
  if (!Array.isArray(response.data.data)) throw new Error('The API did not return the proposed inventory list contract.');
  return response.data;
}
export async function readWorkflow(resource: string, id: string, child?: string): Promise<Envelope> {
  return (await axiosInstance.get<Envelope>(`${workflowEndpoint(resource)}/${encodeURIComponent(id)}${child ? `/${child}` : ''}`)).data;
}
export type Write = { resource: string; id?: string; action?: string; data: Record<string, unknown>; version?: number; idempotencyKey: string; update?: boolean };
export async function writeWorkflow(input: Write): Promise<Envelope> {
  const url = `${workflowEndpoint(input.resource)}${input.id ? `/${encodeURIComponent(input.id)}` : ''}${input.action ? `/${input.action}` : ''}`;
  const headers = workflowWriteHeaders(input);
  const response = input.update ? await axiosInstance.patch<Envelope>(url, input.data, { headers }) : await axiosInstance.post<Envelope>(url, input.data, { headers });
  return response.data;
}
export function workflowError(error: unknown): string {
  const payload = (error as { response?: { data?: { message?: string; error?: string | { message?: string; code?: string; correlationId?: string } } } })?.response?.data;
  if (typeof payload?.error === 'string') return [payload.message, payload.error].filter(Boolean).join(' — ');
  const response = payload?.error;
  if (response?.message) return `${response.message}${response.code ? ` (${response.code})` : ''}${response.correlationId ? ` — ${response.correlationId}` : ''}`;
  if (payload?.message) return payload.message;
  return error instanceof Error ? error.message : 'Request failed. Retry after checking your connection.';
}
export function normalizeRecord(response: Envelope): WorkflowRecord {
  return { ...response.data, version: response.version ?? response.data.version };
}
