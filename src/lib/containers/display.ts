import type { Container } from "./types";
import { toFormDate } from "./types";

export function formatContainerDate(date: string): string {
  const normalized = toFormDate(date);
  if (!normalized) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${normalized}T12:00:00`));
}

export function formatContainerCost(cost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cost);
}

export function formatOptionalContainerCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return "—";
  return formatContainerCost(cost);
}

export function formatContainerId(containerId: number): string {
  return String(containerId);
}

export function formatContainerLabel(container: Pick<Container, "name" | "containerNumber">): string {
  const number = container.containerNumber.trim();
  return number ? `${container.name} · ${number}` : container.name;
}

export function computeContainerKpis(containers: Container[]) {
  const totalCost = containers.reduce((sum, container) => sum + (container.cost > 0 ? container.cost : 0), 0);
  const inTransit = containers.filter((container) => {
    const arrival = toFormDate(container.arrivalDate);
    if (!arrival) return false;
    return new Date(`${arrival}T23:59:59`) >= new Date();
  }).length;

  return {
    total: containers.length,
    inTransit,
    totalCost,
  };
}
