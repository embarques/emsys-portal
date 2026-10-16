/** POST /{endpoint}/search — OR bar search across clearable payment fields. */
export const CLEARABLE_PAYMENT_BAR_OR_SEARCH_FIELDS = [
  "paymentReference",
  "invoice.number",
  "refNumber",
  "status",
  "createdBy.name",
] as const;

export type ClearablePaymentBarOrSearchField =
  (typeof CLEARABLE_PAYMENT_BAR_OR_SEARCH_FIELDS)[number];
