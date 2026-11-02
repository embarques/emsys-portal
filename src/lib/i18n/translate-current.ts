import { getConfigurationSnapshot } from "@/lib/configuration/store";

import { translate } from "./catalog";

/** Translate outside React (API helpers, thrown errors) using the active language preference. */
export function translateCurrent(key: string, params?: Record<string, string | number>): string {
  return translate(getConfigurationSnapshot().language, key, params);
}
