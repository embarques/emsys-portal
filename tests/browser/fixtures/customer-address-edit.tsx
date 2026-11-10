import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CustomerTableAddressCell } from "@/components/customers/customer-addresses-sheet";
import { CustomerViewSheet } from "@/components/customers/customer-view-sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { customer } from "./customer-address-edit-state";

function Fixture() {
  const [viewOpen, setViewOpen] = useState(false);
  return <TooltipProvider>
    <main className="mx-auto max-w-3xl p-6">
      <table><tbody><tr
        onClick={() => window.customerAddressFixture.rowClicks++}
        onDoubleClick={() => window.customerAddressFixture.rowDoubleClicks++}
      ><td className="w-80 p-3"><CustomerTableAddressCell customer={customer()} /></td></tr></tbody></table>
      <button type="button" onClick={() => setViewOpen(true)}>View customer</button>
      <CustomerViewSheet customer={customer()} open={viewOpen} onOpenChange={setViewOpen} onEdit={() => {}} onDelete={() => {}} />
    </main>
  </TooltipProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
