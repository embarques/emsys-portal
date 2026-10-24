/**
 * Appointment context for a new invoice. Ids only — it rides on persisted
 * workspace tabs, and the wizard loads the appointment and live customers.
 */
export type InvoiceAppointmentPrefill = {
  pickupId: string;
  /** Chosen receiver when the appointment has more than one. */
  receiverId?: string;
};

export function isSameInvoiceAppointmentPrefill(
  left: InvoiceAppointmentPrefill | undefined,
  right: InvoiceAppointmentPrefill | undefined,
): boolean {
  return (
    (left?.pickupId ?? "") === (right?.pickupId ?? "") &&
    (left?.receiverId ?? "") === (right?.receiverId ?? "")
  );
}
