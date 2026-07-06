import { z } from "zod";
import { MAX_MAX_WORKSPACE_TABS, MIN_MAX_WORKSPACE_TABS } from "./types";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function createUserPreferenceSchema(t: TranslateFn) {
  const maxWorkspaceTabsMessage = t("settings.validation.maxWorkspaceTabs", {
    min: MIN_MAX_WORKSPACE_TABS,
    max: MAX_MAX_WORKSPACE_TABS,
  });

  return z.object({
    language: z.enum(["en", "es"]),
    theme: z.enum(["system", "light", "dark"]),
    maxWorkspaceTabs: z
      .number()
      .int()
      .min(MIN_MAX_WORKSPACE_TABS, maxWorkspaceTabsMessage)
      .max(MAX_MAX_WORKSPACE_TABS, maxWorkspaceTabsMessage),
  });
}

export type UserPreferenceSchemaValues = z.infer<ReturnType<typeof createUserPreferenceSchema>>;
