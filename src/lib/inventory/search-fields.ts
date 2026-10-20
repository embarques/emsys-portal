export const INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS = ["name", "sku", "category"] as const;

export const INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS = ["itemId", "holderId"] as const;

export const INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS = ["notes", "status"] as const;

export const INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS = ["notes", "status"] as const;

export const INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS = ["companyName", "addresses"] as const;

export const INVENTORY_HOLDER_BAR_OR_SEARCH_FIELDS = ["displayName", "type"] as const;
