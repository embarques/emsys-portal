import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MobileInvoiceRow } from "@/components/invoices/mobile-invoice-row";
import type { Invoice } from "@/lib/invoices/types";
const invoice: Invoice = {invoiceId:"sample",invoiceNumber:"INV-26-001436",date:"2026-10-24",containerId:"67",containerName:"67-26",paymentLocation:"NY",sender:{id:"sender",orderAddressId:"address",name:"Alejandra García",phones:[{id:"phone",number:"3475550124",label:"mobile",isPrimary:true}],addresses:[{id:"address",streetAddress:"2899 Coddington Ave",city:"Bronx",state:"NY",provinceCountry:"US",isPrimary:true}]},receiver:{id:"receiver",orderAddressId:"",name:"Juan Luna",phones:[],addresses:[]},lineItems:[],itemCount:1,comments:[],activity:[],payments:[],discount:0,amountPaid:0,balance:10,createdAt:"",createdBy:"",updatedAt:""};
function App(){const [action,setAction]=useState("");return <main className="bg-background p-3 text-foreground"><div className="overflow-hidden rounded-[18px] border"><MobileInvoiceRow invoice={invoice} selected={false} selectionMode={false} onToggleSelected={()=>{}} onOpen={()=>setAction("open")} /></div><output>{action}</output></main>;}
createRoot(document.getElementById("root")!).render(<App />);
