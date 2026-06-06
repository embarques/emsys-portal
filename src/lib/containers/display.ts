import type { ContainerRecord } from "./types";

export function formatContainerDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatContainerCost(cost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cost);
}

export function truncateContainerId(containerId: string): string {
  return containerId.length > 12 ? `${containerId.slice(0, 8)}…` : containerId;
}

export function containerMatchesQuery(container: ContainerRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    container.containerId,
    container.containerCode,
    container.containerNumber,
    container.bookingNumber,
    container.sealNumber,
    container.broker,
    container.transportCompany,
    formatContainerCost(container.cost),
    formatContainerDate(container.departureDate),
    formatContainerDate(container.arrivalDate),
    container.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeContainerKpis(containers: ContainerRecord[]) {
  const totalCost = containers.reduce((sum, container) => sum + container.cost, 0);
  const inTransit = containers.filter(
    (container) => new Date(`${container.arrivalDate}T23:59:59`) >= new Date()
  ).length;

  return {
    total: containers.length,
    inTransit,
    totalCost,
  };
}
