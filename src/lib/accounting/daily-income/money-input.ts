export function parseMoneyFormInput(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function moneyFormSetValueAs(value: string): number | undefined {
  return parseMoneyFormInput(value);
}
