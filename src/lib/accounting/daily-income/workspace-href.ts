export type DailyIncomeWorkspaceHrefOptions = {
  date: string;
  branchId: number;
  /** Open the create-closeout dialog when no statement exists for this date. */
  create?: boolean;
};

/** `/accounting/daily-income?date=&branchId=` — read on mount by DailyIncomeWorkspace. */
export function buildDailyIncomeWorkspaceHref(options: DailyIncomeWorkspaceHrefOptions): string {
  const params = new URLSearchParams();
  const date = options.date.trim().slice(0, 10);
  if (date) params.set("date", date);
  if (Number.isInteger(options.branchId) && options.branchId > 0) {
    params.set("branchId", String(options.branchId));
  }
  if (options.create) params.set("create", "1");
  const query = params.toString();
  return query ? `/accounting/daily-income?${query}` : "/accounting/daily-income";
}
