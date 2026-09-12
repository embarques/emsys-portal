export type OpenIncomeStatementRef = {
  id: number;
  date: string;
};

export function parseSingleOpenIncomeStatement(message: string): OpenIncomeStatementRef | null {
  const matches = Array.from(message.matchAll(/\b(\d+)\s+(\d{4}-\d{2}-\d{2})\b/g));
  if (matches.length !== 1) return null;
  const [, id, date] = matches[0];
  const statementId = Number(id);
  if (!Number.isFinite(statementId)) return null;
  return { id: statementId, date };
}
