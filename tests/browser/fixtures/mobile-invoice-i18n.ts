import { translate } from "@/lib/i18n/catalog";
const value={ locale: "en", t: (key: string, params?: Record<string, string | number>) => translate("en", key, params) };
export function useTranslation() { return value; }
