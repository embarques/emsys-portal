import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliveryWizard } from "@/components/deliveries/delivery-wizard";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
function Harness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <DeliveryWizard
      target={{
        invoiceId: "68f800000000000000000001",
        number: "000123",
        barcodeId: "68f800000000000000000010",
        route: null,
        delivery: { id: 5, name: "Delivery 5" },
      }}
      onClose={() => setOpen(false)}
      onDelivered={() => setOpen(false)}
    />
  ) : (
    <p>Closed</p>
  );
}
window.wizardMounted = true;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <Harness />
  </QueryClientProvider>,
);
