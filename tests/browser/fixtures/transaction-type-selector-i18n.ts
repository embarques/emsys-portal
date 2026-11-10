import en from "@/locales/en/accounting.json";
import es from "@/locales/es/accounting.json";
import type { TranslateFn } from "@/lib/feedback/messages";

const t: TranslateFn = (key) => {
  const catalogs = { accounting: location.hash.slice(1).split("-").includes("es") ? es : en };
  const text = key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, catalogs);
  if (typeof text !== "string") throw new Error(`Missing translation: ${key}`);
  return text;
};
export function useTranslation() { return { t }; }
