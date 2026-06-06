import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type ContainerRecord = {
  containerId: string;
  containerCode: string;
  containerNumber: string;
  bookingNumber: string;
  sealNumber: string;
  broker: string;
  transportCompany: string;
  cost: number;
  departureDate: string;
  arrivalDate: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type ContainerFormValues = {
  containerId: string;
  containerCode: string;
  containerNumber: string;
  bookingNumber: string;
  sealNumber: string;
  broker: string;
  transportCompany: string;
  cost: string;
  departureDate: string;
  arrivalDate: string;
  createdBy: string;
};

export type ContainerFilterState = {
  query: string;
};

export function createContainerId(): string {
  return crypto.randomUUID();
}

export function createEmptyContainerForm(createdBy = DEFAULT_CREATED_BY): ContainerFormValues {
  return {
    containerId: createContainerId(),
    containerCode: "",
    containerNumber: "",
    bookingNumber: "",
    sealNumber: "",
    broker: "",
    transportCompany: "",
    cost: "",
    departureDate: "",
    arrivalDate: "",
    createdBy,
  };
}

export function containerToFormValues(container: ContainerRecord): ContainerFormValues {
  return {
    containerId: container.containerId,
    containerCode: container.containerCode,
    containerNumber: container.containerNumber,
    bookingNumber: container.bookingNumber,
    sealNumber: container.sealNumber,
    broker: container.broker,
    transportCompany: container.transportCompany,
    cost: container.cost.toFixed(2),
    departureDate: container.departureDate.slice(0, 10),
    arrivalDate: container.arrivalDate.slice(0, 10),
    createdBy: container.createdBy,
  };
}

export function formValuesToContainer(
  values: ContainerFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): ContainerRecord {
  const cost = Number(values.cost);

  if (!values.containerCode.trim()) {
    throw new Error("Container code is required (e.g. 01-26).");
  }

  if (!values.containerNumber.trim()) {
    throw new Error("Container number is required.");
  }

  if (!values.bookingNumber.trim()) {
    throw new Error("Booking number is required.");
  }

  if (!values.departureDate) {
    throw new Error("Departure date is required.");
  }

  if (!values.arrivalDate) {
    throw new Error("Arrival date is required.");
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Cost must be a valid number greater than or equal to 0.");
  }

  return {
    containerId: values.containerId,
    containerCode: values.containerCode.trim(),
    containerNumber: values.containerNumber.trim().toUpperCase(),
    bookingNumber: values.bookingNumber.trim(),
    sealNumber: values.sealNumber.trim(),
    broker: values.broker.trim(),
    transportCompany: values.transportCompany.trim(),
    cost,
    departureDate: values.departureDate,
    arrivalDate: values.arrivalDate,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function suggestNextContainerCode(existing: ContainerRecord[], date = new Date()): string {
  const yearSuffix = String(date.getFullYear()).slice(-2);
  const sameYearCodes = existing
    .map((entry) => entry.containerCode)
    .filter((code) => code.endsWith(`-${yearSuffix}`))
    .map((code) => Number.parseInt(code.split("-")[0] ?? "0", 10))
    .filter((value) => Number.isFinite(value));

  const nextSequence = (sameYearCodes.length > 0 ? Math.max(...sameYearCodes) : 0) + 1;
  return `${String(nextSequence).padStart(2, "0")}-${yearSuffix}`;
}
