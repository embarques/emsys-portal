"use client";

import { useSearchParams } from "next/navigation";
import { invoiceBarcodeFilterRows } from "@/lib/barcodes/invoice-search";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useAppSelector } from "@/lib/store/hooks";
import type { BarcodeFilterState } from "@/lib/barcodes/types";

export function useInitialBarcodeFilters(): BarcodeFilterState {
  const searchParams = useSearchParams();
  const scope = useWorkspaceTabScope();
  const tabHref = useAppSelector((state) =>
    state.layoutTabs.tabs.find((tab) => tab.id === scope?.tabId)?.href,
  );
  // Kept-alive tabs must use their own query, not the active tab's URL.
  const query = scope ? (tabHref?.split("?")[1] ?? "") : searchParams.toString();
  return { query: "", rows: invoiceBarcodeFilterRows(new URLSearchParams(query)) };
}
