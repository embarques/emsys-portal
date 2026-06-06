"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  getConfigurationServerSnapshot,
  getConfigurationSnapshot,
  initializeConfigurationStore,
  setConfigurationStore,
  subscribeConfigurationStore,
} from "./store";
import type { UserConfiguration } from "./types";

export function useConfigurationStore(): UserConfiguration {
  const configuration = useSyncExternalStore(
    subscribeConfigurationStore,
    getConfigurationSnapshot,
    getConfigurationServerSnapshot
  );

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
