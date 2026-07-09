import type { Check } from "./types";

export const MOCK_CHECKS: Check[] = [
  {
    id: "chk-001",
    status: "outstanding",
    invoiceNumber: "INV-2026-0001",
    receiptNumber: "CHK-8842",
    createdAt: "2026-02-04T14:30:00Z",
    createdBy: "Hector Mejia",
    depositedAt: null,
    depositedOn: null,
    depositedBy: null,
  },
  {
    id: "chk-002",
    status: "cleared",
    invoiceNumber: "INV-2026-0003",
    receiptNumber: "CHK-8843",
    createdAt: "2026-02-05T09:15:00Z",
    createdBy: "María López",
    depositedAt: "2026-02-07T10:00:00Z",
    depositedOn: "Wells Fargo · USA Operating",
    depositedBy: "María López",
  },
  {
    id: "chk-003",
    status: "outstanding",
    invoiceNumber: "INV-2026-0008",
    receiptNumber: "CHK-8850",
    createdAt: "2026-02-08T16:45:00Z",
    createdBy: "Carlos Ruiz",
    depositedAt: null,
    depositedOn: null,
    depositedBy: null,
  },
  {
    id: "chk-004",
    status: "cleared",
    invoiceNumber: "INV-2026-0012",
    receiptNumber: "CHK-8855",
    createdAt: "2026-02-10T11:20:00Z",
    createdBy: "Hector Mejia",
    depositedAt: "2026-02-12T08:30:00Z",
    depositedOn: "Chase · DR Collections",
    depositedBy: "Ana Martínez",
  },
  {
    id: "chk-005",
    status: "outstanding",
    invoiceNumber: "INV-2026-0015",
    receiptNumber: "CHK-8860",
    createdAt: "2026-02-14T13:00:00Z",
    createdBy: "Ana Martínez",
    depositedAt: null,
    depositedOn: null,
    depositedBy: null,
  },
  {
    id: "chk-006",
    status: "cleared",
    invoiceNumber: "INV-2026-0018",
    receiptNumber: "CHK-8864",
    createdAt: "2026-02-15T10:05:00Z",
    createdBy: "Carlos Ruiz",
    depositedAt: "2026-02-16T15:45:00Z",
    depositedOn: "Bank of America · USA Operating",
    depositedBy: "Carlos Ruiz",
  },
];

export function cloneChecks(): Check[] {
  return MOCK_CHECKS.map((check) => ({ ...check }));
}
