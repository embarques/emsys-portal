import enCustomers from "@/locales/en/customers.json";
import esCustomers from "@/locales/es/customers.json";
import enCommon from "@/locales/en/common.json";
import esCommon from "@/locales/es/common.json";
import type { TranslateFn } from "@/lib/feedback/messages";
import "./customer-address-edit-state";

export const translateCurrent: TranslateFn = (key, params = {}) => {
  const spanish = window.customerAddressFixture.locale === "es";
  const catalogs = { customers: spanish ? esCustomers : enCustomers, common: spanish ? esCommon : enCommon };
  const text = key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, catalogs);
  return String(text ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? name));
};
export function useTranslation() { return { t: translateCurrent, locale: window.customerAddressFixture.locale }; }
