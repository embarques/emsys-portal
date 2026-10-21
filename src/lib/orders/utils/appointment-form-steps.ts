import {
  hasDuplicateOrderCommentItems,
  isOrderCommentComplete,
  isOrderPartyAddressChosen,
  type OrderFormValues,
} from "@/lib/orders/types";

/** Validate all steps up to the current step, including the complete form at save. */
export function getAppointmentStepError(values: OrderFormValues, step: number, unverifiedSender: boolean) {
  if (!values.sender) return "orders.form.validation.senderRequired";
  if (!isOrderPartyAddressChosen(values.sender, values.senderAddressIndex)) {
    return "orders.form.validation.senderAddressRequired";
  }
  if (unverifiedSender) return "orders.form.validation.unverifiedSenderAddress";
  if (step === 1) return null;
  if (values.receivers.some((row) => !row.customer)) return "orders.form.validation.receiverRequired";
  if (new Set(values.receivers.map((row) => row.customer?.id)).size !== values.receivers.length) {
    return "orders.form.validation.duplicateReceiver";
  }
  if (values.receivers.some((row) => row.customer && !isOrderPartyAddressChosen(row.customer, row.addressIndex))) {
    return "orders.form.validation.receiverAddressRequired";
  }
  if (step === 2) return null;
  if (!values.date.trim() || Number.isNaN(new Date(values.date).getTime())) {
    return "orders.form.validation.pickupDateRequired";
  }
  if (!values.comments.some(isOrderCommentComplete)) return "orders.form.validation.commentRequired";
  if (hasDuplicateOrderCommentItems(values.comments)) return "orders.form.validation.duplicateCommentItem";
  return null;
}

/** A destination needs only its preceding steps to be valid, not its own fields. */
export function canSelectAppointmentStep(values: OrderFormValues, target: number, unverifiedSender: boolean) {
  if (!Number.isInteger(target) || target < 1 || target > 3) return false;
  return target === 1 || getAppointmentStepError(values, target - 1, unverifiedSender) === null;
}
