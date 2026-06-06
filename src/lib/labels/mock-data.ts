import type { LabelActivityEntry, ShipmentLabel } from "./types";

export const MOCK_LABELS: ShipmentLabel[] = [];

export const MOCK_LABEL_ACTIVITY: LabelActivityEntry[] = [];

export function cloneLabels(): ShipmentLabel[] {
  return MOCK_LABELS.map((label) => ({ ...label }));
}

export function cloneLabelActivity(): LabelActivityEntry[] {
  return MOCK_LABEL_ACTIVITY.map((entry) => ({ ...entry }));
}
