import { isAxiosError } from "axios";

import type { Order, OrderFormValues } from "@/lib/orders/types";

export type OrderWriteOptions = { allowDuplicatePendingAppointment?: boolean };

export type ExistingPendingAppointment = {
  id: number;
  date: string;
  purpose: string;
};

export type SubmitCreateOrder = (
  values: OrderFormValues,
  options?: OrderWriteOptions,
) => Order | Promise<Order>;

const DUPLICATE_MESSAGE = "Duplicate pending appointment warning";
const DUPLICATE_CODE = "DUPLICATE_PENDING_APPOINTMENT";

function readConflictPayload(error: unknown): Record<string, unknown> | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data;
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

function conflictCode(payload: Record<string, unknown>): string | null {
  if (payload.code === DUPLICATE_CODE) return DUPLICATE_CODE;
  const nested = payload.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const code = (nested as Record<string, unknown>).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Only the verified pending-appointment conflict is eligible for override. */
export function isDuplicatePendingAppointmentWarning(error: unknown): boolean {
  const payload = readConflictPayload(error);
  if (!payload) return false;
  // API contract: message "Duplicate pending appointment warning" and/or
  // data.code "DUPLICATE_PENDING_APPOINTMENT" on HTTP 409 (create only).
  if (payload.message === DUPLICATE_MESSAGE) return true;
  return conflictCode(payload) === DUPLICATE_CODE;
}

export function getExistingPendingAppointmentsFromError(error: unknown): ExistingPendingAppointment[] {
  const payload = readConflictPayload(error);
  if (!payload) return [];

  const nested =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : payload;

  const raw = nested.existingAppointments;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const dateValue = item.date;
      const date =
        typeof dateValue === "string"
          ? dateValue
          : dateValue instanceof Date
            ? dateValue.toISOString()
            : "";
      return {
        id,
        date,
        purpose: typeof item.purpose === "string" ? item.purpose.trim() : "",
      } satisfies ExistingPendingAppointment;
    })
    .filter((entry): entry is ExistingPendingAppointment => entry !== null);
}

export class DuplicatePendingAppointmentCancelledError extends Error {
  constructor() {
    super("Duplicate pending appointment cancelled");
  }
}

export async function createWithDuplicatePendingAppointmentConfirmation(
  values: OrderFormValues,
  submit: SubmitCreateOrder,
  confirm: (existing: ExistingPendingAppointment[]) => Promise<boolean>,
): Promise<Order> {
  const snapshot = structuredClone(values);
  try {
    return await submit(structuredClone(snapshot));
  } catch (error) {
    if (!isDuplicatePendingAppointmentWarning(error)) throw error;
    const existing = getExistingPendingAppointmentsFromError(error);
    if (!(await confirm(existing))) throw new DuplicatePendingAppointmentCancelledError();
    return await submit(structuredClone(snapshot), { allowDuplicatePendingAppointment: true });
  }
}
