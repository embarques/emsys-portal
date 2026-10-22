import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliverDialog } from "@/components/deliveries/deliver-dialog";
import { DeliveryMobileRow } from "@/components/deliveries/delivery-mobile-row";
import type { DeliverTarget } from "@/lib/deliveries/hooks/use-deliver-invoice";
import type { AssignedDeliveryBarcode } from "@/lib/deliveries/types";

declare global {
  interface Window { fixtureView?: string; mobileDeliverClicked?: string }
}

const target: DeliverTarget = { delivery: { id: 5, name: "Delivery 5" }, barcodeId: "A", number: "A", invoiceId: "invoice-1", route: { id: "route-1", name: "Daily route 1" } };
const row: AssignedDeliveryBarcode = {
  id: 1, barcodeId: "A", number: "000123456789", invoiceId: "invoice-1", invoiceNumber: "INV-1", description: "Large box of household goods",
  status: { id: 4, name: "ALM-RD" }, container: { id: 3, name: "64-26" }, route: { id: "route-1", name: "1-64-26" }, delivery: { id: 5, name: "Delivery 5" },
  receiver: { name: "Maria Altagracia Perez Rodriguez", address1: "Calle Duarte #45, Ensanche La Fe", apartment: "Apto 2B", city: "Santiago", province: "Santiago", zipcode: "51000",
    phones: [{ number: "8095550101", displayNumber: "(809) 555-0101" }, { number: "8295550102" }] },
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Harness() {
  const [open, setOpen] = useState(true);
  return open ? <DeliverDialog target={target} onClose={() => setOpen(false)} onDelivered={() => { window.delivered = true; setOpen(false); }} /> : <p role="status">closed</p>;
}
createRoot(document.getElementById("root")!).render(
  window.fixtureView === "mobile-row"
    ? <main className="w-full"><DeliveryMobileRow row={row} canDeliver onDeliver={(value) => { window.mobileDeliverClicked = value.number; }} /></main>
    : <QueryClientProvider client={client}><Harness /></QueryClientProvider>,
);
