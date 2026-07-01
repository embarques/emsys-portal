"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { useConfigurationStore } from "@/lib/configuration/use-configuration";
import { useAppDispatch } from "@/lib/store/hooks";
import { enforceWorkspaceTabLimit } from "@/lib/store/layout/tabs-slice";

export function ConfigurationBootstrap() {
  const { setTheme } = useTheme();
  const dispatch = useAppDispatch();
  const configuration = useConfigurationStore();

  useEffect(() => {
    setTheme(configuration.theme);
    dispatch(enforceWorkspaceTabLimit());
  }, [configuration.maxWorkspaceTabs, configuration.theme, dispatch, setTheme]);

  return null;
}
