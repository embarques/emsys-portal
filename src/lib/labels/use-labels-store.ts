"use client";

import { useSyncExternalStore } from "react";

import {
  cloneLabelActivityFromStore,
  cloneLabelsFromStore,
  getLabelActivitySnapshot,
  getLabelsSnapshot,
  subscribeLabelsStore,
} from "@/lib/labels/store";

export function useLabelsStore() {
  const labels = useSyncExternalStore(subscribeLabelsStore, getLabelsSnapshot, getLabelsSnapshot);
  const activityLog = useSyncExternalStore(subscribeLabelsStore, getLabelActivitySnapshot, getLabelActivitySnapshot);

  return {
    labels,
    activityLog,
    cloneLabels: cloneLabelsFromStore,
    cloneLabelActivity: cloneLabelActivityFromStore,
  };
}
