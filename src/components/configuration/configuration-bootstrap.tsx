"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { useConfigurationStore } from "@/lib/configuration/use-configuration";

export function ConfigurationBootstrap() {
  const { setTheme } = useTheme();
  const configuration = useConfigurationStore();

  useEffect(() => {
    setTheme(configuration.theme);
  }, [configuration.theme]);

  return null;
}
