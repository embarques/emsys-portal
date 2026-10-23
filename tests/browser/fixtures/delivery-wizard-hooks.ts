import { useMutation, useQuery } from "@tanstack/react-query";
import type { CompleteDeliveryInput } from "@/lib/deliveries/schemas/delivery-wizard.schema";
import type { InvoiceDocument } from "@/lib/invoices/documents";

declare global {
  interface Window {
    wizardBalance?: number;
    wizardBalanceError?: boolean;
    wizardCannotPay?: boolean;
    wizardDenied?: string[];
    wizardPayments?: unknown[];
    wizardPendingChecks?: { id: string; amount: number; checkNumber?: string }[];
    wizardNoStatement?: boolean;
    wizardStatements?: unknown[];
    wizardRowRate?: number;
    wizardRouteRate?: number;
    wizardRouteReads?: number;
    wizardReadOnly?: boolean;
    wizardPoliciesFail?: boolean;
    wizardNoPolicies?: boolean;
    wizardNoReceiver?: boolean;
    wizardUploadFailAt?: number;
    wizardUploadCalls?: number;
    wizardUploadedNames?: string[];
    wizardReads?: number;
    wizardRequests?: CompleteDeliveryInput[];
    wizardFailComplete?: boolean;
    wizardCompleted?: boolean;
    wizardRetryCommitted?: boolean;
    wizardCompanyChanged?: boolean;
    wizardVisual?: boolean;
    wizardNoItems?: boolean;
    wizardMounted?: boolean;
  }
}
export const invoiceId = "68f800000000000000000001";
export const barcodeIds = [
  "68f800000000000000000010",
  "68f800000000000000000011",
  "68f800000000000000000012",
];
const auth = { companyId: "company-1", idToken: "session-1" };
export const store = {
  getState: () => ({
    auth: window.wizardCompanyChanged
      ? { companyId: "company-2", idToken: "session-2" }
      : auth,
  }),
};
export function useAppSelector<T>(select: (state: { auth: typeof auth }) => T) {
  return select({ auth });
}
export function useAuth() {
  return {
    isAuthenticated: true,
    user: { uid: "driver-1" },
    email: "driver@example.test",
    hasPermission: (name: string) => !window.wizardReadOnly
      && !(window.wizardCannotPay && name === "canCreateJournal")
      && !(window.wizardDenied ?? []).includes(name),
  };
}
export function normalizeApiError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : "Error",
    status: (error as { status?: number })?.status,
  };
}
export function useActiveInvoicePolicies(enabled: boolean) {
  return useQuery({
    queryKey: ["wizard-policies"],
    enabled,
    queryFn: async () => {
      if (window.wizardPoliciesFail) throw new Error("Policies failed");
      return window.wizardNoPolicies
        ? []
        : [
            {
              id: 1,
              title: "Delivery terms",
              body: "Check the merchandise before signing.",
              active: true,
            },
          ];
    },
    retry: false,
  });
}
export const apiClient = {
  get: async (url: string) => {
    if (!url.endsWith("/items")) throw new Error("Unexpected read: " + url);
    window.wizardReads = (window.wizardReads ?? 0) + 1;
    if (window.wizardNoItems) throw new Error("No pending items");
    return {
      success: true,
      data: {
        invoiceId,
        invoiceNumber: "INV-26-001434",
        pendingStatus: { id: 6, name: "CONDUCE" },
        deliveredStatus: { id: 7, name: "ENTREGADO" },
        deliveryId: 5,
        deliveryName: "Delivery 5",
        container: { id: 39, name: "64-26" },
        receiver: window.wizardNoReceiver
          ? null
          : {
              name: "Maria Perez",
              IDNumber: "INVOICE-CUSTOMER-ID",
              address: {
                address1: "Calle Duarte 45",
                city: "Santiago",
                state: "Santiago",
              },
            },
        barcodes: barcodeIds.map((barcodeId, index) => ({
          barcodeId: (window as unknown as { wizardLegacy?: boolean })
            .wizardLegacy
            ? "000000000000000000000000"
            : barcodeId,
          ...((window as unknown as { wizardLegacy?: boolean }).wizardLegacy
            ? { legacyId: 765464 + index }
            : {}),
          number: `00012${index + 3}`,
          description: index === 2 ? "Wooden chair" : "Large box",
        })),
      },
    };
  },
  post: async (url: string, input: CompleteDeliveryInput) => {
    if (url.endsWith("/signature-options")) return { success:true, data:[{invoiceId,invoiceNumber:"INV-26-001434",senderSignature:null,receiverSignatures:[{id:"68f800000000000000000099",deliveryId:5,signerName:"Pedro Ramirez",signedAt:"2026-10-23T00:00:00Z"}]}] };
    if (!url.endsWith("/complete"))
      throw new Error("Unexpected mutation: " + url);
    window.wizardRequests = [
      ...(window.wizardRequests ?? []),
      JSON.parse(JSON.stringify(input)),
    ];
    await new Promise((resolve) => setTimeout(resolve, 100));
    if ((window as unknown as { wizardConflict?: boolean }).wizardConflict)
      throw Object.assign(new Error("Delivery changed"), { status: 409 });
    if (window.wizardFailComplete) throw new Error("Completion failed");
    window.wizardCompleted = true;
    return {
      success: true,
      data: {
        invoiceId,
        deliveryId: 5,
        signatureId: "68f800000000000000000099",
        deliveredCount:
          input.barcodeIds.length + (input.legacyBarcodeIds?.length ?? 0),
      },
    };
  },
};
export async function uploadInvoiceDocument(
  id: string,
  file: File,
  progress: (value: number) => void,
): Promise<InvoiceDocument> {
  if (id !== invoiceId) throw new Error("Wrong invoice");
  window.wizardUploadCalls = (window.wizardUploadCalls ?? 0) + 1;
  if (window.wizardUploadCalls === window.wizardUploadFailAt)
    throw new Error("Upload failed");
  progress(50);
  await new Promise((resolve) => setTimeout(resolve, 50));
  window.wizardUploadedNames = [
    ...(window.wizardUploadedNames ?? []),
    file.name,
  ];
  return {
    id: (100 + window.wizardUploadCalls).toString(16).padStart(24, "0"),
    invoiceId: id,
    name: file.name,
    originalName: file.name,
    mimeType: "image/png",
    size: file.size,
    version: 1,
    deleting: false,
  };
}

export function useFeedback() { return { notifySuccess: () => {} }; }
export function useGenerateInvoiceReport() {
 return useMutation({ mutationFn: async () => {
  await new Promise(resolve=>setTimeout(resolve,100));
  return {url:"http://localhost/fixture.pdf"};
 } });
}


export async function fetchInvoiceById() {
  if (window.wizardBalanceError) throw new Error("Balance unavailable");
  return { invoiceId, invoiceNumber: "INV-26-001434", balance: window.wizardBalance ?? 0,
    cost: 100, amountPaid: 0, discount: 0, payments: [], lineItems: [], sender: null, receiver: null };
}
export async function fetchCurrentUser() { return { id: 1, name: "Driver", branch: { id: 1 } }; }
export async function searchIncomeStatementForDate(_branch: number, date: string) {
  if (window.wizardNoStatement && !window.wizardStatements?.length) return null;
  return { id: 1, date, status: "OPEN", branch: { id: 1 }, currency: "USD", rate: 1 };
}
export async function createIncomeStatement(values: unknown) {
  window.wizardStatements = [...(window.wizardStatements ?? []), values];
  return { id: 1, date: "2026-10-23", status: "OPEN", branch: { id: 1 }, currency: "USD", rate: 1 };
}
export async function fetchEmployees() { return { items: [{ id: 1, name: "Driver", department: "", title: "", active: true, branch: { id: 1 } }] }; }
export async function fetchActiveRoutes() { return { items: [] }; }
export async function fetchActiveRouteById(id: string) {
  window.wizardRouteReads = (window.wizardRouteReads ?? 0) + 1;
  return { id, rate: window.wizardRouteRate };
}
export async function fetchChecks() {
  return { items: (window.wizardPendingChecks ?? []).map((check) => ({
    id: check.id, status: "OUTSTANDING", checkNumber: check.checkNumber ?? "000123", paymentAmount: check.amount,
    datePosted: "2026-10-23", invoice: { id: invoiceId, number: "INV-26-001434" },
  })), page: 1, resultsPerPage: 100, total: window.wizardPendingChecks?.length ?? 0 };
}
export async function fetchClearablePayments() { return { items: [], page: 1, resultsPerPage: 100, total: 0 }; }
export async function fetchChartAccounts() { return { items: [{ id: 1, name: "Delivery bank", displayName: "Delivery bank", type: "BANK", code: "BANK-1" }] }; }
export async function fetchAccountingPaymentMethods() { return [{ id: 1, name: "CASH" }, { id: 3, name: "CHECK" }]; }
export async function createDailyIncomeJournal(_statement: unknown, values: { amount: number; paymentMethodName: string }) {
  window.wizardPayments = [...(window.wizardPayments ?? []), values];
  if (values.paymentMethodName === "CASH") window.wizardBalance = (window.wizardBalance ?? 0) - values.amount;
  else window.wizardPendingChecks = [...(window.wizardPendingChecks ?? []), { id: "check-new", amount: values.amount }];
  return { id: "payment-1", amount: values.amount };
}
export function useBranchPicker() { return { data: { items: [{ id: 1, code: "US", name: "Office" }] } }; }
