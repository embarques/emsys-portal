import {
  hasDuplicateOrderCommentItems,
  isOrderCommentComplete,
  isOrderPartyAddressChosen,
  type OrderFormValues,
  type OrderReceiverFormValue,
} from "@/lib/orders/types";

function getSenderStepError(values: OrderFormValues, unverifiedSender: boolean) {
  if (!values.sender) return "orders.form.validation.senderRequired";
  if (!isOrderPartyAddressChosen(values.sender, values.senderAddressIndex)) {
    return "orders.form.validation.senderAddressRequired";
  }
  if (unverifiedSender) return "orders.form.validation.unverifiedSenderAddress";
  return null;
}

/** A receiver row is ready to save when it has a customer and a chosen address. */
export function isCompleteAppointmentReceiver(row: OrderReceiverFormValue): boolean {
  return Boolean(row.customer && isOrderPartyAddressChosen(row.customer, row.addressIndex));
}

/** Drop empty/incomplete receiver templates so they never block save or reach the API. */
export function getCompleteAppointmentReceivers(
  receivers: OrderFormValues["receivers"],
): OrderFormValues["receivers"] {
  return receivers.filter(isCompleteAppointmentReceiver);
}

/** True when at least one draft row still needs a customer. */
export function hasEmptyAppointmentReceiverTemplate(
  receivers: OrderFormValues["receivers"],
): boolean {
  return receivers.some((row) => !row.customer);
}

/** Keep one blank receiver slot ready after each selection (Receiver 2, 3, …). */
export function withTrailingEmptyAppointmentReceiver(
  receivers: OrderFormValues["receivers"],
  createKey: () => string = () => crypto.randomUUID(),
): OrderFormValues["receivers"] {
  if (hasEmptyAppointmentReceiverTemplate(receivers)) return receivers;
  return [...receivers, { key: createKey(), customer: null, addressIndex: 0 }];
}

function getReceiversStepError(values: OrderFormValues) {
  const complete = getCompleteAppointmentReceivers(values.receivers);
  if (new Set(complete.map((row) => row.customer?.id)).size !== complete.length) {
    return "orders.form.validation.duplicateReceiver";
  }
  return null;
}

function getScheduleAndCommentsError(values: OrderFormValues) {
  if (!values.date.trim() || Number.isNaN(new Date(values.date).getTime())) {
    return "orders.form.validation.pickupDateRequired";
  }
  if (!values.comments.some(isOrderCommentComplete)) return "orders.form.validation.commentRequired";
  if (hasDuplicateOrderCommentItems(values.comments)) return "orders.form.validation.duplicateCommentItem";
  return null;
}

/** Sender + date + comments — used before continuing to receivers or saving with receivers skipped. */
export function getAppointmentDetailsError(values: OrderFormValues, unverifiedSender: boolean) {
  return getSenderStepError(values, unverifiedSender) ?? getScheduleAndCommentsError(values);
}

/** Receiver rows only — empty/incomplete templates are ignored; duplicates among complete rows are not. */
export function getAppointmentReceiversError(values: OrderFormValues) {
  return getReceiversStepError(values);
}

/** Validate all steps up to the current step, including the complete form at save. */
export function getAppointmentStepError(values: OrderFormValues, step: number, unverifiedSender: boolean) {
  const senderError = getSenderStepError(values, unverifiedSender);
  if (senderError) return senderError;
  if (step === 1) return null;

  const receiversError = getReceiversStepError(values);
  if (receiversError) return receiversError;
  if (step === 2) return null;

  return getScheduleAndCommentsError(values);
}

/** Customers already chosen on other receiver rows, so a row's picker cannot select them again. */
export function getOtherReceiverCustomerIds(receivers: OrderFormValues["receivers"], rowKey: string): string[] {
  return receivers.flatMap((row) => (row.key !== rowKey && row.customer?.id ? [row.customer.id] : []));
}

/** A destination needs only its preceding steps to be valid, not its own fields. */
export function canSelectAppointmentStep(values: OrderFormValues, target: number, unverifiedSender: boolean) {
  if (!Number.isInteger(target) || target < 1 || target > 3) return false;
  return target === 1 || getAppointmentStepError(values, target - 1, unverifiedSender) === null;
}
