import { translate } from "@/lib/i18n/catalog";
export function useTranslation() { return { locale: "en", t: (key: string, params?: Record<string, string | number>) => translate("en", key, params) }; }
