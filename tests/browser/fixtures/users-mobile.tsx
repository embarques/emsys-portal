import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UserMobileRow } from "@/components/users/user-mobile-row";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import type { User } from "@/lib/users/types";
const user = { id:73, uid:"firebase-73", name:"Adaleidy Martinez Rodriguez", email:"adaleidy.martinez@embarquestenares.example", active:true, branch:{id:1,name:"Embarque Tenares (RD)"}, role:{id:1,name:"Administrador"}, startTime:"08:00", endTime:"18:00", createdAt:"", updatedAt:"", createdBy:null, updatedBy:null } as User;
function App() {
 if (document.documentElement.dataset.emptyHours === "true") {
  user.startTime = "   ";
  user.endTime = "";
 }
 const [selected, setSelected] = useState(false);
 const [action, setAction] = useState("");
 return <main className="mx-auto max-w-xl p-4"><UserMobileRow user={user} selected={selected} selectionMode={selected} onToggleSelected={(_, checked) => setSelected(checked)} onOpen={() => setAction("open")} onEdit={() => setAction("edit")} onDeactivate={() => setAction("deactivate")} /><output>{action}</output></main>;
}
createRoot(document.getElementById("root")!).render(document.documentElement.dataset.fixture === "pickup-search"
  ? <div className="bg-card p-4"><TableSearchInput value="" onChange={() => {}} placeholder="Buscar citas" inputClassName="h-12 rounded-2xl border-border bg-background text-base text-foreground shadow-none" /></div>
  : <App />);
