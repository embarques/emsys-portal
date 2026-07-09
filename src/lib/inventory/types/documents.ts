export type ReceiptLineFormValues = {
  itemId: string;
  quantity: number;
};

export type ReceiptFormValues = {
  receiptDate: string;
  source: string;
  receivedBy: string;
  notes: string;
  lines: ReceiptLineFormValues[];
};

export type InventoryReceiptLine = {
  id: string;
  receiptId: string;
  itemId: string;
  quantity: number;
};

export type InventoryReceipt = {
  id: string;
  receiptDate: string;
  source: string;
  receivedBy: string;
  notes?: string;
  createdAt: string;
};

export type DispatchStatus = "pending" | "sent" | "confirmed";

export type DispatchLineFormValues = {
  itemId: string;
  quantity: number;
};

export type DispatchFormValues = {
  dispatchDate: string;
  recipientId: string;
  dispatchedBy: string;
  invoiceNumber: string;
  notes: string;
  lines: DispatchLineFormValues[];
  markSent: boolean;
};

export type InventoryDispatchLine = {
  id: string;
  dispatchId: string;
  itemId: string;
  quantity: number;
};

export type InventoryDispatch = {
  id: string;
  dispatchDate: string;
  recipientId: string;
  dispatchedBy: string;
  status: DispatchStatus;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
};

export const DISPATCH_STATUSES: { value: DispatchStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "confirmed", label: "Confirmed" },
];

export function createEmptyReceiptLine(): ReceiptLineFormValues {
  return { itemId: "", quantity: 1 };
}

export function createEmptyDispatchLine(): DispatchLineFormValues {
  return { itemId: "", quantity: 1 };
}
