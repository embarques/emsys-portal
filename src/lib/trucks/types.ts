import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type FuelType = "gas" | "diesel";
export type TruckBranch = "usa" | "dr";

export type Truck = {
  truckId: string;
  name: string;
  vin: string;
  year: number;
  fuelType: FuelType;
  branch: TruckBranch;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type TruckFormValues = {
  truckId: string;
  name: string;
  vin: string;
  year: string;
  fuelType: FuelType;
  branch: TruckBranch;
  createdBy: string;
};

export type TruckFilterState = {
  query: string;
  fuelType: FuelType | "all";
  branch: TruckBranch | "all";
};

export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "gas", label: "Gas" },
  { value: "diesel", label: "Diesel" },
];

export const TRUCK_BRANCHES: { value: TruckBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export function createTruckId(): string {
  return crypto.randomUUID();
}

export function createEmptyTruckForm(): TruckFormValues {
  return {
    truckId: createTruckId(),
    name: "",
    vin: "",
    year: String(new Date().getFullYear()),
    fuelType: "diesel",
    branch: "usa",
    createdBy: DEFAULT_CREATED_BY,
  };
}

export function truckToFormValues(truck: Truck): TruckFormValues {
  return {
    truckId: truck.truckId,
    name: truck.name,
    vin: truck.vin,
    year: String(truck.year),
    fuelType: truck.fuelType,
    branch: truck.branch,
    createdBy: truck.createdBy,
  };
}

export function formValuesToTruck(
  values: TruckFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Truck {
  return {
    truckId: values.truckId,
    name: values.name.trim(),
    vin: values.vin.trim().toUpperCase(),
    year: Number(values.year),
    fuelType: values.fuelType,
    branch: values.branch,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
