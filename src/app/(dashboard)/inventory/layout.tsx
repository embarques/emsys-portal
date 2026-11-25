import { notFound } from "next/navigation";

import { isInventoryEnabled } from "@/lib/inventory/feature";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  if (!isInventoryEnabled()) notFound();
  return children;
}
