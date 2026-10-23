"use client";

import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { InvoiceAppointmentPrefill } from "@/lib/invoices/appointment-invoice-prefill";
import { useInvoiceCreateAccess } from "@/lib/invoices/hooks/use-invoice-create-access";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { formatOrderId } from "@/lib/orders/display";
import { getUniqueOrderReceivers, type Order } from "@/lib/orders/types";

/**
 * Starts a new invoice from one appointment. Appointments with several
 * receivers ask which one first; desktop opens an invoice tab, mobile a dialog.
 */
export function useCreateAppointmentInvoice() {
  const { t } = useTranslation();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const { canCreateFromAppointment: canCreateInvoice, isAssignedOnly } = useInvoiceCreateAccess();
  const [receiverChoiceOrder, setReceiverChoiceOrder] = useState<Order | null>(null);
  const [dialogPrefill, setDialogPrefill] = useState<InvoiceAppointmentPrefill | null>(null);

  function openInvoice(order: Order, receiverId?: string) {
    const prefill: InvoiceAppointmentPrefill = {
      pickupId: String(order.id),
      ...(receiverId ? { receiverId } : {}),
    };

    if (isDesktopTabs) {
      openFormTab({
        feature: "invoices",
        // Assigned-only users cannot open /invoices; keep their form under Appointments.
        baseHref: isAssignedOnly ? "/appointments" : "/invoices",
        mode: "add",
        label: t("orders.actions.createInvoiceTab", { id: formatOrderId(order) }),
        invoicePrefill: prefill,
      });
      return;
    }
    setDialogPrefill(prefill);
  }

  function startInvoice(order: Order) {
    const receivers = getUniqueOrderReceivers(order);
    if (receivers.length > 1) {
      setReceiverChoiceOrder(order);
      return;
    }
    openInvoice(order, receivers[0]?.id);
  }

  function chooseReceiver(receiverId: string) {
    const order = receiverChoiceOrder;
    if (!order) return;
    setReceiverChoiceOrder(null);
    openInvoice(order, receiverId);
  }

  return {
    canCreateInvoice,
    startInvoice,
    receiverChoiceOrder,
    chooseReceiver,
    cancelReceiverChoice: () => setReceiverChoiceOrder(null),
    dialogPrefill,
    closeDialog: () => setDialogPrefill(null),
  };
}
