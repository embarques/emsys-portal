"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  clearMemoPadContent,
  getMemoPadSnapshot,
  initializeMemoPadStore,
  setMemoPadContent,
  subscribeMemoPadStore,
} from "./store";

export function useMemoPadStore() {
  const subscribe = useCallback((listener: () => void) => subscribeMemoPadStore(listener), []);
  const getSnapshot = useCallback(() => getMemoPadSnapshot(), []);
  const getServerSnapshot = useCallback(() => "", []);

  const content = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initializeMemoPadStore();
  }, []);

  const updateContent = useCallback((next: string) => {
    setMemoPadContent(next);
  }, []);

  const clearContent = useCallback(() => {
    clearMemoPadContent();
  }, []);

  return { content, updateContent, clearContent };
}
