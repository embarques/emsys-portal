import { createRoot } from "react-dom/client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationLoader } from "@/components/app-shell/application-loader";
import { PredefinedRouteDialog } from "@/components/predefined-routes/predefined-route-dialog";
import { PredefinedRouteFilterRow } from "@/components/orders/predefined-route-filter-row";
import { usePredefinedRouteWorkspace } from "@/lib/predefined-routes/hooks/use-predefined-route-workspace";

function Fixture() {
  const [selected, setSelected] = useState("");
  const state = usePredefinedRouteWorkspace((route) => setSelected(String(route.id)));
  if (document.documentElement.dataset.fixture === "loader") return <ApplicationLoader stage="session" />;
  return <main className="mx-auto max-w-2xl p-4">
    <button onClick={() => state.edit({ id: 2, name: "Miami Sur", content: "Kendall, 33157, Cutler Bay, Homestead, 33030" })}>Edit existing</button>
    <button className="mt-4 block text-primary">+ New filter</button>
    <PredefinedRouteFilterRow value={selected} options={[{value:"2",label:"Miami Sur"},{value:"15",label:"Boston"}]} loading={false} canCreate={document.documentElement.dataset.canCreate !== "false"} onChange={setSelected} onAdd={() => state.edit(null)} onRetry={() => {}} />
    <output>{selected || "all"}</output>
    <PredefinedRouteDialog state={state} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
