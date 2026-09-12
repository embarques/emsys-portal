/** API 400 when the invoice date/branch has no OPEN daily-income closeout. */
export function isMissingOpenIncomeStatementError(message: string | null | undefined): boolean {
  const normalized = message?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return (
    normalized.includes("open income statement must exist") ||
    (normalized.includes("income statement") &&
      normalized.includes("invoice date") &&
      normalized.includes("branch"))
  );
}
