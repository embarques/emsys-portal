export const INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS = ["item"] as const;

export const INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS = ["item.item"] as const;

export const INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS = ["item.item", "supplier.companyName"] as const;

export const INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS = ["item.item", "dispatchedTo.name"] as const;

export const INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS = ["companyName", "contactNames", "emails"] as const;
