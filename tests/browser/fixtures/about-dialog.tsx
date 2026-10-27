import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AboutDialog } from "@/components/app-shell/about-dialog";

function Fixture() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="fixed inset-0 z-[9999] bg-background">
      <button onClick={() => setOpen(true)}>About</button>
    </div>
    <AboutDialog open={open} onOpenChange={setOpen} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
