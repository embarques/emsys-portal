"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  getConfigurationSnapshot,
  initializeConfigurationStore,
  setConfigurationStore,
  subscribeConfigurationStore,
} from "./store";
import type { UserConfiguration } from "./types";

export function useConfigurationStore(): UserConfiguration {
  const subscribe = useCallback((listener: () => void) => subscribeConfigurationStore(listener), []);

  const getSnapshot = useCallback(() => getConfigurationSnapshot(), []);
  const getServerSnapshot = useCallback(() => getConfigurationSnapshot(), []);

  const configuration = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initializeConfigurationStore();
  }, []);

  return configuration;
}

export function useSaveConfiguration() {
  const saveConfiguration = useCallback((next: UserConfiguration) => {
    setConfigurationStore(next);
  }, []);

  return saveConfiguration;
}

export function useConfigurationHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    initializeConfigurationStore();
    setHydrated(true);
  }, []);

  return hydrated;
}
