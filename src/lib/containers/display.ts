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

  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let departedPastMonth = 0;
  let departedPast90Days = 0;
  let departedPastYear = 0;

  for (const container of containers) {
    const departure = toFormDate(container.departureDate);
    if (!departure) continue;

    const departedAt = new Date(`${departure}T12:00:00`);
    if (departedAt > now) continue;

    if (departedAt >= oneYearAgo) {
      departedPastYear += 1;
      if (departedAt >= ninetyDaysAgo) {
        departedPast90Days += 1;
      }
      if (departedAt >= oneMonthAgo) {
        departedPastMonth += 1;
      }
    }
  }

  return {
    total: containers.length,
    inTransit,
    totalCost,
    departedPastMonth,
    departedPast90Days,
    departedPastYear,
  };
}
