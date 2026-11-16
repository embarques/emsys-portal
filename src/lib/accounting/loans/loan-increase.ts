/** Keep the command hidden until deployed loan lifecycle/replay acceptance is complete (B12). */
export function isLoanIncreaseEnabled(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED === "true";
}
