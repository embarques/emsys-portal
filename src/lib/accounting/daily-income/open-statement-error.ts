export type OpenIncomeStatementRef = {
  id: number;
  date: string;
};

const OPEN_STATEMENT_PAIR = /\b(\d+)\s+(\d{4}-\d{2}-\d{2})\b/g;

/** Parse every `id date` pair from an API "previous income statements are still open" message. */
export function parseOpenIncomeStatements(message: string): OpenIncomeStatementRef[] {
  const seen = new Set<number>();
  const results: OpenIncomeStatementRef[] = [];
  for (const match of message.matchAll(OPEN_STATEMENT_PAIR)) {
    const statementId = Number(match[1]);
    const date = match[2];
    if (!Number.isFinite(statementId) || seen.has(statementId)) continue;
    seen.add(statementId);
    results.push({ id: statementId, date });
  }
  return results;
}

/** Returns the only open statement when the error lists exactly one; otherwise null. */
export function parseSingleOpenIncomeStatement(message: string): OpenIncomeStatementRef | null {
  const matches = parseOpenIncomeStatements(message);
  return matches.length === 1 ? matches[0] : null;
}
