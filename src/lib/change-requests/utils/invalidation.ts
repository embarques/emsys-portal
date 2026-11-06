import type { ChangeResource } from "../api";

/** Refresh the resource and dependent balances/queues after approval. */
export function changeAffectedPrefixes(resource: ChangeResource): readonly string[] {
  switch (resource) {
    case "pickup": return ["orders"];
    case "invoice": return ["invoices", "barcodes", "accounting"];
    case "journal": return ["accounting", "invoices", "inventory"];
    case "labels": return ["barcodes", "invoices", "deliveries"];
    case "inventory": return ["inventory", "inventory-workflow", "accounting"];
  }
}
