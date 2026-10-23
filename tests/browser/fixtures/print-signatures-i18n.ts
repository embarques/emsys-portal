import { translate } from "@/lib/i18n/catalog";
export function useTranslation() {
  const locale = (window as unknown as { spanish?: boolean }).spanish ? "es" : "en";
  return {
    locale,
    t: (key: string, values: Record<string, string | number> = {}) =>
      window.visual ? translate(locale, key, values) : key,
  };
}
