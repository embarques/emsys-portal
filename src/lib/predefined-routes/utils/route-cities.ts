/** Trims entries, collapses inner whitespace, drops blanks and case-insensitive duplicates (keeps order). */
export function normalizeRouteCities(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const raw of entries) {
    const city = raw.trim().replace(/\s+/g, " ");
    const key = city.toLocaleLowerCase();
    if (!city || seen.has(key)) continue;
    seen.add(key);
    cities.push(city);
  }
  return cities;
}

/** Splits a predefined route `content` string into its city / ZIP entries. */
export function parseRouteCities(content: string): string[] {
  return normalizeRouteCities(content.split(","));
}

/**
 * Splits text typed or pasted into one form row at its commas: `current` stays in that row and `added`
 * become new rows. A trailing comma adds one empty row so the user can keep typing.
 */
export function splitRouteCityInput(raw: string): { current: string; added: string[] } {
  const [current = "", ...rest] = raw.split(",").map((part) => part.trim());
  const added = rest.filter(Boolean);
  if (rest.length && rest.at(-1) === "") added.push("");
  return { current, added };
}

/** Canonical `content` value persisted by the API (`"Miami, 33010, Doral"`). */
export function formatRouteCities(cities: readonly string[]): string {
  return normalizeRouteCities(cities).join(", ");
}
