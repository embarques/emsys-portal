import invoices from "@/locales/en/invoices.json";
export function useTranslation() {
  return {
    locale: "en",
    t: (key: string, params: Record<string, unknown> = {}) => {
      const value = key
        .split(".")
        .slice(1)
        .reduce<unknown>(
          (result, part) => (result as Record<string, unknown>)?.[part],
          invoices,
        );
      return String(value ?? key).replace(/\{(\w+)\}/g, (_, name) =>
        String(params[name] ?? name),
      );
    },
  };
}
