import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderForm } from "@/components/orders/order-form";
import { DuplicatePendingAppointmentDialog } from "@/components/orders/duplicate-pending-appointment-dialog";
import { useDuplicatePendingAppointmentConfirmation } from "@/lib/orders/hooks/use-duplicate-pending-appointment-confirmation";
import { DuplicatePendingAppointmentCancelledError } from "@/lib/orders/duplicate-pending-appointment";
import type { Order } from "@/lib/orders/types";
import { createEmptyOrderForm, type OrderFormValues } from "@/lib/orders/types";
import { customer as appointmentSender } from "./customers";
if (document.documentElement.dataset.multipleAddresses === "true") {
  appointmentSender.addresses.push({
    ...appointmentSender.addresses[0], id: "a2", address1: "456 Broadway", isPrimary: false,
  });
}
const customerQueryClient = new QueryClient();

function AppointmentFixture() {
  const [initialValues] = useState(() => ({
    ...createEmptyOrderForm(), sender: appointmentSender, senderId: appointmentSender.id,
    receivers: (document.documentElement.dataset.emptyReceivers === "true" ? [] : [1, 2]).map((id) => ({ key: `receiver-${id}`, addressIndex: 0,
      customer: { ...appointmentSender, id: `receiver-${id}`, name: `Receiver ${id}`, customerType: 2 } })),
  }));
  const [saved, setSaved] = useState<OrderFormValues | null>(null);
  const [attempts, setAttempts] = useState(0);
  const duplicateConfirmation = useDuplicatePendingAppointmentConfirmation();
  return <QueryClientProvider client={customerQueryClient}>
    <div className="flex h-screen min-h-0 flex-col">
      <OrderForm initialValues={initialValues} submitLabel="Save appointment" onCancel={() => {}}
        isSubmitting={duplicateConfirmation.isConfirming}
        onSubmit={async (values) => {
          if (document.documentElement.dataset.duplicateConfirmation !== "true") {
            setSaved(values); return { error: null };
          }
          try {
            const created = await duplicateConfirmation.submit(values, async (draft, options) => {
              setAttempts((count) => count + 1);
              if (!options?.allowDuplicatePendingAppointment) {
                // Mirror POST /v1/pickups 409 contract from API_PAYLOADS.md.
                throw { isAxiosError: true, response: { status: 409, data: {
                  success: false,
                  message: "Duplicate pending appointment warning",
                  error: "An incomplete appointment already exists for this sender and selected address.",
                  data: {
                    code: "DUPLICATE_PENDING_APPOINTMENT",
                    existingAppointments: [{ id: 24, date: "2026-11-18", purpose: "PICKUP" }],
                  },
                } } };
              }
              setSaved(draft);
              return { id: 42 } as Order;
            });
            return { error: null, cancelled: !created };
          } catch (error) {
            if (error instanceof DuplicatePendingAppointmentCancelledError) return { error: null, cancelled: true };
            throw error;
          }
        }} />
      <DuplicatePendingAppointmentDialog open={duplicateConfirmation.pendingExisting !== null}
        existing={duplicateConfirmation.pendingExisting ?? []}
        onConfirm={() => duplicateConfirmation.respond(true)} onCancel={() => duplicateConfirmation.respond(false)} />
      <output id="appointment-saved" hidden>{JSON.stringify(saved)}</output>
      <output id="appointment-attempts" hidden>{attempts}</output>
    </div>
  </QueryClientProvider>;
}

createRoot(document.getElementById("root")!).render(<AppointmentFixture />);
