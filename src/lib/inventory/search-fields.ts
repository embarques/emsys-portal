/** Main search identifies supplies; category stays an explicit advanced filter. */
export const INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS = ["name", "sku"] as const;

export const INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS = ["itemId", "holderId"] as const;

/** `notes` is not in the receipts/dispatches search allow-list (400). */
export const INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS = ["status"] as const;

export const INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS = ["status"] as const;

/** `addresses` / `contacts.*` are not in the suppliers search allow-list (400). */
export const INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS = ["companyName"] as const;

export const INVENTORY_HOLDER_BAR_OR_SEARCH_FIELDS = ["displayName", "type"] as const;
