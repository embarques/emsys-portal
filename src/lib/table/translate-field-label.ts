import type { TranslateFn } from "@/lib/feedback/messages";
import { getCatalog, lookupCatalogValue } from "@/lib/i18n/catalog";
import { lowerFirstLetter } from "@/lib/table/column-labels";
import type { TableFilterFieldDefinition, TableFilterFieldOption } from "@/lib/table/filter-types";

const NAMESPACE = "tableFields";

type MessageTree = Record<string, unknown>;

function englishSection(section: string): MessageTree {
  const namespace = getCatalog("en")[NAMESPACE] as MessageTree | undefined;
  const node = namespace?.[section];
  return node && typeof node === "object" && !Array.isArray(node) ? (node as MessageTree) : {};
}

/** Compare English copy ignoring case, spacing, and `...` vs `…` (e.g. `licensePlate` ≈ `License plate`). */
function normalizeEnglish(value: string): string {
  return value.replace(/\.\.\.$/, "…").replace(/\s+/g, "").toLowerCase();
}

/** Catalog keys under `node` (a string leaf or one level of named variants). */
function leafKeys(node: unknown, basePath: string): string[] {
  if (typeof node === "string") return [basePath];
  if (!node || typeof node !== "object" || Array.isArray(node)) return [];
  return Object.entries(node)
    .filter(([, value]) => typeof value === "string")
    .map(([variant]) => `${basePath}.${variant}`);
}

const ENTER_FIELD_KEY = `${NAMESPACE}.filter.enterField`;

/** English (or an untranslated locale) keeps the source copy verbatim instead of the catalog wording. */
function isEnglishTranslator(t: TranslateFn): boolean {
  return t(ENTER_FIELD_KEY) === lookupCatalogValue(getCatalog("en"), ENTER_FIELD_KEY);
}

/**
 * Translate `englishText` only when it equals the English catalog value of one of `keys`.
 * Copy that is already localized (or not catalogued) is returned unchanged, so English stays identical.
 */
function translateMatchingKey(keys: string[], englishText: string, t: TranslateFn): string {
  if (isEnglishTranslator(t)) return englishText;

  const target = normalizeEnglish(englishText);
  const englishTree = getCatalog("en");

  for (const key of keys) {
    const english = lookupCatalogValue(englishTree, key);
    if (english === undefined || normalizeEnglish(english) !== target) continue;

    const localized = t(key);
    return localized === key ? englishText : localized;
  }

  return englishText;
}

/** Localized display label for a filter field / API column id, falling back to `fallbackLabel`. */
export function translateTableFieldLabel(field: string, fallbackLabel: string, t: TranslateFn): string {
  if (!fallbackLabel) return fallbackLabel;
  const keys = leafKeys(englishSection("fields")[field], `${NAMESPACE}.fields.${field}`);
  return translateMatchingKey(keys, fallbackLabel, t);
}

/** Localized option label for a static select option of `field`. */
export function translateTableFieldOptionLabel(
  field: string,
  option: TableFilterFieldOption,
  t: TranslateFn,
): string {
  const fieldOptions = englishSection("options")[field];
  if (!fieldOptions || typeof fieldOptions !== "object" || !Object.hasOwn(fieldOptions, option.value)) {
    return option.label;
  }
  return translateMatchingKey([`${NAMESPACE}.options.${field}.${option.value}`], option.label, t);
}

const ENTER_FIELD_PLACEHOLDER = /^Enter (.+?)(?:…|\.\.\.)$/;

/**
 * Localized input placeholder. Known placeholders come from `tableFields.placeholders`;
 * `Enter <label>…` placeholders are rebuilt from the localized field label.
 */
export function translateTableFieldPlaceholder(
  placeholder: string,
  fallbackLabel: string,
  localizedLabel: string,
  t: TranslateFn,
): string {
  if (!placeholder || isEnglishTranslator(t)) return placeholder;

  const keys = Object.keys(englishSection("placeholders")).map((name) => `${NAMESPACE}.placeholders.${name}`);
  const catalogued = translateMatchingKey(keys, placeholder, t);
  if (catalogued !== placeholder) return catalogued;

  const match = placeholder.match(ENTER_FIELD_PLACEHOLDER);
  if (match && normalizeEnglish(match[1]!) === normalizeEnglish(fallbackLabel)) {
    return t(ENTER_FIELD_KEY, { field: lowerFirstLetter(localizedLabel) });
  }

  return placeholder;
}

/**
 * Localize filter definitions for display only. Field ids, operators, value types, and
 * option values are preserved so the filter payload sent to the API does not change.
 */
export function localizeTableFilterFields(
  fields: readonly TableFilterFieldDefinition[],
  t: TranslateFn,
): TableFilterFieldDefinition[] {
  return fields.map((definition) => {
    const label = translateTableFieldLabel(definition.field, definition.label, t);
    return {
      ...definition,
      label,
      ...(definition.placeholder
        ? { placeholder: translateTableFieldPlaceholder(definition.placeholder, definition.label, label, t) }
        : {}),
      ...(definition.options
        ? {
            options: definition.options.map((option) => ({
              ...option,
              label: translateTableFieldOptionLabel(definition.field, option, t),
            })),
          }
        : {}),
    };
  });
}
