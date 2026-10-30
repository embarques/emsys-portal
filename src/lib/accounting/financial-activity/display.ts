const NEUTRAL_BADGE_CLASS = "border-transparent bg-muted text-muted-foreground";

const PAYMENT_METHOD_BADGE_CLASSES: Record<string, string> = {
  CASH: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CHECK: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  CHEQUE: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  ZELLE: "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300",
  DEPOSIT: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "CREDIT-CARD": "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

/** Tailwind needs literal class names, so the palette is spelled out. */
const EMPLOYEE_BADGE_CLASSES = [
  "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "border-transparent bg-lime-500/15 text-lime-700 dark:text-lime-300",
  "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "border-transparent bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  "border-transparent bg-purple-500/15 text-purple-700 dark:text-purple-300",
];

export function normalizePaymentMethodName(name?: string): string {
  return (name ?? "").trim().toUpperCase().replace(/[_\s]+/g, "-");
}

export function getPaymentMethodBadgeClass(name?: string): string {
  return PAYMENT_METHOD_BADGE_CLASSES[normalizePaymentMethodName(name)] ?? NEUTRAL_BADGE_CLASS;
}

/** Stable per-employee color so the same person reads the same across rows and pages. */
export function getEmployeeBadgeClass(employeeId?: number): string {
  if (!employeeId || !Number.isInteger(employeeId) || employeeId <= 0) return NEUTRAL_BADGE_CLASS;
  return EMPLOYEE_BADGE_CLASSES[employeeId % EMPLOYEE_BADGE_CLASSES.length];
}
