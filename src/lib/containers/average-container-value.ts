import type { DepartedContainerStatPeriod } from "@/lib/containers/departed-container-stats";

export type ContainerStatsWindow = {
  start: string;
  end: string;
};

/** `GET /containers/stats/average-value` payload. */
export type AverageContainerValueStats = {
  period: DepartedContainerStatPeriod;
  timezone: string;
  window: ContainerStatsWindow;
  previousWindow: ContainerStatsWindow;
  average: number;
  previousAverage: number;
  containerCount: number;
  totalValue: number;
};
