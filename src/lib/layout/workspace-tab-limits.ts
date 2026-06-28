import { getConfigurationSnapshot } from "@/lib/configuration/store";
import { normalizeMaxWorkspaceTabs } from "@/lib/configuration/types";

/** Resolved maximum open workspace tabs for the current user (from configuration). */
export function getMaxWorkspaceTabs(): number {
  return normalizeMaxWorkspaceTabs(getConfigurationSnapshot().maxWorkspaceTabs);
}
