import { z } from "zod";
import { MAX_MAX_WORKSPACE_TABS, MIN_MAX_WORKSPACE_TABS } from "./types";

export const userPreferenceSchema = z.object({
  language: z.enum(["en", "es"]),
  theme: z.enum(["system", "light", "dark"]),
  maxWorkspaceTabs: z.number().int().min(MIN_MAX_WORKSPACE_TABS).max(MAX_MAX_WORKSPACE_TABS),
});
