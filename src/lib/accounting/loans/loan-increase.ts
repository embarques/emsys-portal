/** The API has no loan-increase command yet; keep the entry hidden until it ships. */
export function isLoanIncreaseEnabled(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED === "true";
}
