import common from "@/locales/en/common.json";
import deliveries from "@/locales/en/deliveries.json";
export function useTranslation() {
  return {
    locale: "en",
    t: (key: string, values: Record<string, string | number> = {}) => {
      if (!window.wizardVisual) return key;
      const value = key
        .split(".")
        .slice(1)
        .reduce<unknown>(
          (item, part) =>
            item && typeof item === "object"
              ? (item as Record<string, unknown>)[part]
              : undefined,
          key.startsWith("common.") ? common : deliveries,
        );
      return typeof value === "string"
        ? value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
            String(values[name] ?? ""),
          )
        : key;
    },
  };
}
