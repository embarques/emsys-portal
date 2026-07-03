import type { Vehicle } from "./types";

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "665f1a2b3c4d5e6f7a8b9c0d",
    vehicleId: "veh-001",
    name: "Unit 12 — Freightliner",
    vin: "1FUJGLDR57LM12345",
    licensePlate: "FLT-1201",
    year: 2019,
    fuelType: "diesel",
    branch: { id: 1, code: "usa" },
    active: true,
    inspectionDate: "2026-03-15",
    registrationDate: "2026-01-10",
    createdAt: "2026-06-04T14:22:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    id: "665f1a2b3c4d5e6f7a8b9c0e",
    vehicleId: "veh-002",
    name: "Unit 08 — Isuzu NPR",
    vin: "JALC4W160F7K67890",
    licensePlate: "NPR-0842",
    year: 2021,
    fuelType: "diesel",
    branch: { id: 2, code: "dr" },
    active: true,
    inspectionDate: "2026-04-02",
    registrationDate: "2026-02-18",
    createdAt: "2026-06-03T11:05:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    id: "665f1a2b3c4d5e6f7a8b9c0f",
    vehicleId: "veh-003",
    name: "Unit 04 — Ford Transit",
    vin: "1FTBR1XM5GKA11223",
    licensePlate: "TRN-0417",
    year: 2022,
    fuelType: "gas",
    branch: { id: 1, code: "usa" },
    active: true,
    inspectionDate: "2026-05-20",
    registrationDate: "2026-03-05",
    createdAt: "2026-06-02T18:40:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    id: "665f1a2b3c4d5e6f7a8b9c10",
    vehicleId: "veh-004",
    name: "Unit 15 — Kenworth T680",
    vin: "1XKYDP9X7KJ445566",
    licensePlate: "KWT-1568",
    year: 2018,
    fuelType: "diesel",
    branch: { id: 2, code: "dr" },
    active: false,
    inspectionDate: "2026-02-28",
    registrationDate: "2025-12-01",
    createdAt: "2026-06-01T09:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
  {
    id: "665f1a2b3c4d5e6f7a8b9c11",
    vehicleId: "veh-005",
    name: "Unit 02 — Chevy Express",
    vin: "1GCWGAFG5L1234567",
    licensePlate: "EXP-0235",
    year: 2020,
    fuelType: "gas",
    branch: { id: 1, code: "usa" },
    active: true,
    inspectionDate: "2026-01-22",
    registrationDate: "2025-11-15",
    createdAt: "2026-05-30T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T16:30:00Z",
  },
  {
    id: "665f1a2b3c4d5e6f7a8b9c12",
    vehicleId: "veh-006",
    name: "Unit 21 — Volvo VNL",
    vin: "4V4NC9EH5NN778899",
    licensePlate: "VNL-2173",
    year: 2023,
    fuelType: "diesel",
    branch: { id: 2, code: "dr" },
    active: true,
    inspectionDate: "2026-05-08",
    registrationDate: "2026-04-12",
    createdAt: "2026-05-28T13:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-28T13:20:00Z",
  },
];

export function cloneVehicles(): Vehicle[] {
  return MOCK_VEHICLES.map((vehicle) => ({ ...vehicle }));
}

export function getVehicleById(vehicleId: string): Vehicle | undefined {
  return MOCK_VEHICLES.find((vehicle) => vehicle.vehicleId === vehicleId);
}

export function getVehicleByRecordId(id: string): Vehicle | undefined {
  return MOCK_VEHICLES.find((vehicle) => vehicle.id === id);
}
