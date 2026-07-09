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

/** Fallback label when only a container id is available (no API lookup). */
export function formatContainerIdLabel(containerId: string | number): string {
  const trimmed = String(containerId).trim();
  if (!trimmed) return "—";
  return `#${trimmed}`;
}

export function formatContainerLabel(container: Pick<Container, "name" | "containerNumber">): string {
  const number = container.containerNumber.trim();
  return number ? `${container.name} · ${number}` : container.name;
}

/** Container number sent on delivery vehicle route writes (e.g. `34-26`). */
export function formatContainerRouteNumber(
  container: Pick<Container, "name" | "containerNumber">,
): string {
  const number = container.containerNumber.trim();
  return number || container.name.trim();
}

export const DEPARTED_PERIOD_DAYS = {
  past30Days: 30,
  past90Days: 90,
  past180Days: 180,
  past360Days: 360,
} as const;

/** Extrapolates a departed count over `periodDays` to an annual pace. */
export function formatDepartedAnnualPace(
  departedCount: number,
  periodDays: number,
  locale = "en",
): string {
  if (periodDays <= 0 || !Number.isFinite(departedCount)) return "0";

  const pace = (departedCount * 365) / periodDays;
  if (!Number.isFinite(pace) || pace === 0) return "0";
  if (pace >= 100 || Math.abs(pace - Math.round(pace)) < 0.05) {
    return Math.round(pace).toLocaleString(locale);
  }

  return pace.toLocaleString(locale, { maximumFractionDigits: 1 });
}

function subtractDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() - days);
  return result;
}

export function computeContainerKpis(containers: Container[]) {
  const totalCost = containers.reduce((sum, container) => sum + (container.cost > 0 ? container.cost : 0), 0);
  const inTransit = containers.filter((container) => {
    const arrival = toFormDate(container.arrivalDate);
    if (!arrival) return false;
    return new Date(`${arrival}T23:59:59`) >= new Date();
  }).length;

  const now = new Date();
  const thirtyDaysAgo = subtractDays(now, DEPARTED_PERIOD_DAYS.past30Days);
  const ninetyDaysAgo = subtractDays(now, DEPARTED_PERIOD_DAYS.past90Days);
  const oneEightyDaysAgo = subtractDays(now, DEPARTED_PERIOD_DAYS.past180Days);
  const threeSixtyDaysAgo = subtractDays(now, DEPARTED_PERIOD_DAYS.past360Days);

  let departedPast30Days = 0;
  let departedPast90Days = 0;
  let departedPast180Days = 0;
  let departedPast360Days = 0;

  for (const container of containers) {
    const departure = toFormDate(container.departureDate);
    if (!departure) continue;

    const departedAt = new Date(`${departure}T12:00:00`);
    if (departedAt > now) continue;

    if (departedAt >= threeSixtyDaysAgo) {
      departedPast360Days += 1;
      if (departedAt >= oneEightyDaysAgo) {
        departedPast180Days += 1;
        if (departedAt >= ninetyDaysAgo) {
          departedPast90Days += 1;
          if (departedAt >= thirtyDaysAgo) {
            departedPast30Days += 1;
          }
        }
      }
    }
  }

  return {
    total: containers.length,
    inTransit,
    totalCost,
    departedPast30Days,
    departedPast90Days,
    departedPast180Days,
    departedPast360Days,
  };
}
