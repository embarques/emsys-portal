import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
import { WorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
const w = window as Window & { tabbed?: boolean; tabClicks?: number };
const ids = Array.from({length: w.trip ? 1 : 20}, (_, i) => (i+1).toString(16).padStart(24,"0"));
const client = new QueryClient({ defaultOptions: { queries: { retry:false }, mutations:{retry:false} } });
function Harness() {
 const [selected,setSelected]=useState(ids);
 useEffect(()=>{w.switchPrintInvoice=(id:string)=>setSelected([id]);return()=>{delete w.switchPrintInvoice;};},[]);
 return <InvoicePrintSignaturesDialog invoiceIds={selected} trip={w.trip ? {deliveryId:"5"} : undefined} onClose={() => { w.printClosed=true; }} />;
}
function TabbedShell() {
 const [active,setActive]=useState(true);
 const [portal,setPortal]=useState<HTMLDivElement|null>(null);
 // Inline layout: Tailwind does not scan tests/, so fixture-only utility classes are not generated.
 return <div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
  <nav style={{display:"flex",alignItems:"flex-end",gap:8,height:120,flexShrink:0,padding:"0 16px 8px"}}>
   <button type="button" onClick={()=>{w.tabClicks=(w.tabClicks??0)+1;setActive(false);}}>Other tab</button>
   <button type="button" onClick={()=>setActive(true)}>Invoices tab</button>
  </nav>
  <div hidden={!active} style={{position:"relative",flex:1,display:active ? "block" : "none"}}>
   <WorkspaceTabScope tabId="invoices" isActive={active} portalContainer={portal}><Harness /></WorkspaceTabScope>
   <div ref={setPortal} style={{position:"absolute",inset:0,zIndex:50}} />
  </div>
 </div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>{w.tabbed ? <TabbedShell /> : <Harness />}</QueryClientProvider>);
