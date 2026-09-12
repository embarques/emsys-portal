export function parseMoneyFormInput(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function moneyFormSetValueAs(value: string): number | undefined {
  return parseMoneyFormInput(value);
}

/** Editable display while focused; currency string when blurred. */
export function formatMoneyFormEditValue(value: unknown): string {
  const parsed = parseMoneyFormInput(value);
  return parsed == null ? "" : String(parsed);
}

export function formatMoneyFormDisplayValue(value: unknown, currency = "USD"): string {
  const parsed = parseMoneyFormInput(value);
  if (parsed == null) return "";
  const code = currency.trim().toUpperCase() === "DOP" ? "DOP" : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(parsed);
}
