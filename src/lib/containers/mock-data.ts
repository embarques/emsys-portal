import type { ContainerRecord } from "./types";

export const MOCK_CONTAINERS: ContainerRecord[] = [
  {
    containerId: "cnt-001",
    containerCode: "01-26",
    containerNumber: "SMLUD320939203",
    bookingNumber: "BKG-2026-00421",
    sealNumber: "SL-884921",
    broker: "Atlantic Customs Brokers",
    transportCompany: "Maersk Line",
    cost: 4200,
    departureDate: "2026-01-18",
    arrivalDate: "2026-02-05",
    createdAt: "2026-01-10T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    containerId: "cnt-002",
    containerCode: "02-26",
    containerNumber: "MSKU9876543210",
    bookingNumber: "BKG-2026-00587",
    sealNumber: "SL-901244",
    broker: "Caribbean Trade Services",
    transportCompany: "MSC",
    cost: 3850,
    departureDate: "2026-02-10",
    arrivalDate: "2026-03-01",
    createdAt: "2026-02-03T11:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    containerId: "cnt-003",
    containerCode: "03-26",
    containerNumber: "TCLU4567890123",
    bookingNumber: "BKG-2026-00712",
    sealNumber: "SL-912880",
    broker: "Gulf Coast Logistics",
    transportCompany: "CMA CGM",
    cost: 5100,
    departureDate: "2026-03-15",
    arrivalDate: "2026-04-02",
    createdAt: "2026-03-05T15:45:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    containerId: "cnt-004",
    containerCode: "04-26",
    containerNumber: "HLCU1122334455",
    bookingNumber: "BKG-2026-00890",
    sealNumber: "SL-920011",
    broker: "Metro Freight Brokers",
    transportCompany: "Hapag-Lloyd",
    cost: 4625.5,
    departureDate: "2026-04-20",
    arrivalDate: "2026-05-10",
    createdAt: "2026-04-18T08:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
  {
    containerId: "cnt-005",
    containerCode: "05-26",
    containerNumber: "OOLU7788990011",
    bookingNumber: "BKG-2026-01003",
    sealNumber: "SL-931550",
    broker: "Island Customs Group",
    transportCompany: "OOCL",
    cost: 3975,
    departureDate: "2026-05-28",
    arrivalDate: "2026-06-18",
    createdAt: "2026-05-20T16:45:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T16:30:00Z",
  },
];

export function cloneContainers(): ContainerRecord[] {
  return MOCK_CONTAINERS.map((container) => ({ ...container }));
}

export function getContainerById(containerId: string): ContainerRecord | undefined {
  return MOCK_CONTAINERS.find((container) => container.containerId === containerId);
}
