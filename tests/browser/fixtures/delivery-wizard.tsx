import { DeliveryMobileRow } from "@/components/deliveries/delivery-mobile-row";
import type { AssignedDeliveryBarcode } from "@/lib/deliveries/types";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliveryWizard } from "@/components/deliveries/delivery-wizard";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
function Harness() {
  const [open, setOpen] = useState(true);
  const fixtureView = (window as unknown as { deliveryNotice?: string }).deliveryNotice;
  if (fixtureView) {
    const row = { id:1, number:"ET065260030", invoiceId: fixtureView === "missing-invoice" ? "" : "68f800000000000000000001", invoiceNumber:"INV-26-001434", description:"Box", receiver:null, delivery: fixtureView === "valid" ? {id:5,name:"Trip"} : null, route:{id:"route-id",name:"1-64-26"} } as AssignedDeliveryBarcode;
    return <DeliveryMobileRow row={row} canDeliver canPrint onDeliver={() => {}} onPrint={() => {}} />;
  }
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
