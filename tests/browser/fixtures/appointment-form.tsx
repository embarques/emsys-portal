import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderForm } from "@/components/orders/order-form";
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
  return <QueryClientProvider client={customerQueryClient}>
    <div className="flex h-screen min-h-0 flex-col">
      <OrderForm initialValues={initialValues} submitLabel="Save appointment" onCancel={() => {}}
        onSubmit={(values) => { setSaved(values); return { error: null }; }} />
      <output id="appointment-saved" hidden>{JSON.stringify(saved)}</output>
    </div>
  </QueryClientProvider>;
}

createRoot(document.getElementById("root")!).render(<AppointmentFixture />);
