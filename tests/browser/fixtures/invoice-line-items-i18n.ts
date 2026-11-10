import enInvoices from "@/locales/en/invoices.json";
import esInvoices from "@/locales/es/invoices.json";
import enCommon from "@/locales/en/common.json";
import esCommon from "@/locales/es/common.json";
import type { TranslateFn } from "@/lib/feedback/messages";
import "./invoice-line-items-state";

export const translateCurrent: TranslateFn = (key, params = {}) => {
  const spanish = window.invoiceLineItemsFixture.locale === "es";
  const catalogs = { invoices: spanish ? esInvoices : enInvoices, common: spanish ? esCommon : enCommon };
  const text = key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, catalogs);
  return String(text ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? name));
};
export function useTranslation() { return { t: translateCurrent, locale: window.invoiceLineItemsFixture.locale }; }
