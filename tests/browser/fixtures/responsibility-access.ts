export function useResponsibilityAccess(type: string) {
 return { ready: true, canAssign: location.hash.includes(type === "INVOICE" ? "invoice-grant" : "payment-grant"), ownEmployee: { id: 5 } };
}
