import type { Customer } from "@/lib/customers/types";
import { createEmptyInvoiceForm, type InvoiceFormValues } from "@/lib/invoices/types";
import { getUniqueOrderReceivers, type Order } from "@/lib/orders/types";

export function resolveAppointmentInvoiceReceiver(
  order: Pick<Order, "receiver" | "receivers">,
  receiverId?: string,
): Customer | null {
  const receivers = getUniqueOrderReceivers(order);
  const chosenId = receiverId?.trim();
  if (chosenId) return receivers.find((receiver) => receiver.id === chosenId) ?? null;
  return receivers.length === 1 ? receivers[0] : null;
}

export function buildInvoiceFormFromAppointment(
  order: Pick<Order, "id" | "sender" | "receiver" | "receivers">,
  receiverId?: string,
  base: InvoiceFormValues = createEmptyInvoiceForm(),
): InvoiceFormValues {
  const receiver = resolveAppointmentInvoiceReceiver(order, receiverId);
  const sender = order.sender ?? null;

  return {
    ...base,
    pickupId: String(order.id),
    senderId: sender?.id?.trim() ?? "",
    sender,
    receiverId: receiver?.id ?? "",
    receiver,
  };
}
