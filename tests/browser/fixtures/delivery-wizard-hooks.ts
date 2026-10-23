import { useMutation, useQuery } from "@tanstack/react-query";
import type { CompleteDeliveryInput } from "@/lib/deliveries/schemas/delivery-wizard.schema";
import type { InvoiceDocument } from "@/lib/invoices/documents";

declare global {
  interface Window {
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
    hasPermission: () => !window.wizardReadOnly,
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
