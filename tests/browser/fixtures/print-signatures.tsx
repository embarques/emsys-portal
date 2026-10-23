import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
const w = window;
const ids = Array.from({length: w.trip ? 1 : 20}, (_, i) => (i+1).toString(16).padStart(24,"0"));
const client = new QueryClient({ defaultOptions: { queries: { retry:false }, mutations:{retry:false} } });
function Harness() {
 const [selected,setSelected]=useState(ids);
 useEffect(()=>{w.switchPrintInvoice=(id:string)=>setSelected([id]);return()=>{delete w.switchPrintInvoice;};},[]);
 return <InvoicePrintSignaturesDialog invoiceIds={selected} trip={w.trip ? {deliveryId:"5"} : undefined} onClose={() => { w.printClosed=true; }} />;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
