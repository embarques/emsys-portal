import { translate } from "@/lib/i18n/catalog";
import type { TranslateFn } from "@/lib/feedback/messages";
const t: TranslateFn = (key, params) => translate("en", key, params);
export function useTranslation() { return { t, locale: "en" }; }
