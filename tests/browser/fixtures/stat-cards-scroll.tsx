import { createRoot } from "react-dom/client";
import { Tags } from "lucide-react";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

const nested = document.documentElement.dataset.nested === "true";
createRoot(document.getElementById("root")!).render(
  <main id="page-scroll" style={nested ? { height: "100dvh", overflowY: "auto" } : undefined}>
    <div style={{ padding: 16 }}>
      <header style={{ height: 140 }}><h1>Articulos</h1></header>
      <StatCards items={Array.from({ length: 6 }, (_, index) => ({
        label: `Panel ${index + 1}`, value: `${index + 1}`, description: "Summary", icon: Tags,
      }))} />
      <section style={{ height: 1500, paddingTop: 80 }}>Page content below the panels</section>
    </div>
  </main>,
);
