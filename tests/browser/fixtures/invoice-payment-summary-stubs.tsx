import React from "react";

/**
 * Replaces only the sibling sections of the overview tab (line items, payments,
 * comments, activity, barcodes, documents, address/phone rows) so the fixture
 * mounts the real InvoiceViewSheet without their data hooks. The payment
 * summary block, totals grid and status badges under test are production code.
 */
export function useAuth() { return { hasPermission: () => true }; }

const Empty = () => null;
export const InvoiceLineItemsSection = Empty;
export const InvoiceDocumentsSection = Empty;
export const InvoiceActivitySection = Empty;
export const InvoiceBarcodeStatusSection = Empty;
export const InvoiceCommentsSection = Empty;
export const InvoicePackageTrackerSection = Empty;
export const InvoicePaymentsSection = Empty;
export const AddressActionRow = Empty;
export const PhoneActionRow = Empty;
// Its children are DropdownMenuItem elements that need the Radix menu context.
export const TableSelectionActionsMenu = Empty;
