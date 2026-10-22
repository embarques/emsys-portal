import common from "@/locales/en/common.json";
import predefinedRoutes from "@/locales/en/predefined-routes.json";
const catalog: Record<string, unknown> = { common, predefinedRoutes };
export function useTranslation() {
  return { t: (key: string, values: Record<string, unknown> = {}) => {
    const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog);
    return String(value ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name));
  } };
}
