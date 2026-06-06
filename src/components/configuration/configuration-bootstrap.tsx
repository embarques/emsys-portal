"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { initializeConfigurationStore, getConfigurationSnapshot } from "@/lib/configuration/store";

export function ConfigurationBootstrap() {
  const { setTheme } = useTheme();

  useEffect(() => {
    initializeConfigurationStore();
    const configuration = getConfigurationSnapshot();
    setTheme(configuration.theme);
  }, [setTheme]);

  return null;
}
