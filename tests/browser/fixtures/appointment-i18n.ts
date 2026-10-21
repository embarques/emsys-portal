import orders from "@/locales/en/orders.json";
import common from "@/locales/en/common.json";
import customers from "@/locales/en/customers.json";

const t = (key: string, values?: Record<string, string | number>) => {
  if (document.documentElement.dataset.fixture !== "appointment") return key;
  let value: unknown = { orders, common, customers };
  for (const part of key.split(".")) {
    value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
  }
  return typeof value === "string" ? value.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? name)) : key;
};
export function useTranslation() { return { t }; }
