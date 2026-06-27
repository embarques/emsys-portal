import type { TableFilterRowState } from "@/lib/table/filter-types";

/**
 * A saved advanced-filter preset owned by the authenticated user.
 *
 * `userId`, `createdAt`, and `updatedAt` are assigned server-side; the client
 * never sends them. Tenant isolation is handled by the `x-company-id` header
 * (each company has its own database), so there is no `companyId` field.
 */
export type FilterPreset = {
  id: string;
  scope: string;
  name: string;
  rows: TableFilterRowState[];
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Payload for POST/PUT /filter-presets. */
export type FilterPresetWriteInput = {
  scope: string;
  name: string;
  rows: TableFilterRowState[];
};
