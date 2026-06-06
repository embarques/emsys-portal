import type { Truck } from "./types";

export const MOCK_TRUCKS: Truck[] = [
  {
    truckId: "trk-001",
    name: "Unit 12 — Freightliner",
    vin: "1FUJGLDR57LM12345",
    year: 2019,
    fuelType: "diesel",
    branch: "usa",
    createdAt: "2026-06-04T14:22:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    truckId: "trk-002",
    name: "Unit 08 — Isuzu NPR",
    vin: "JALC4W160F7K67890",
    year: 2021,
    fuelType: "diesel",
    branch: "dr",
    createdAt: "2026-06-03T11:05:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    truckId: "trk-003",
    name: "Unit 04 — Ford Transit",
    vin: "1FTBR1XM5GKA11223",
    year: 2022,
    fuelType: "gas",
    branch: "usa",
    createdAt: "2026-06-02T18:40:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    truckId: "trk-004",
    name: "Unit 15 — Kenworth T680",
    vin: "1XKYDP9X7KJ445566",
    year: 2018,
    fuelType: "diesel",
    branch: "dr",
    createdAt: "2026-06-01T09:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
  {
    truckId: "trk-005",
    name: "Unit 02 — Chevy Express",
    vin: "1GCWGAFG5L1234567",
    year: 2020,
    fuelType: "gas",
    branch: "usa",
    createdAt: "2026-05-30T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T16:30:00Z",
  },
  {
    truckId: "trk-006",
    name: "Unit 21 — Volvo VNL",
    vin: "4V4NC9EH5NN778899",
    year: 2023,
    fuelType: "diesel",
    branch: "dr",
    createdAt: "2026-05-28T13:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-28T13:20:00Z",
  },
];

export function cloneTrucks(): Truck[] {
  return MOCK_TRUCKS.map((truck) => ({ ...truck }));
}

export function getTruckById(truckId: string): Truck | undefined {
  return MOCK_TRUCKS.find((truck) => truck.truckId === truckId);
}
