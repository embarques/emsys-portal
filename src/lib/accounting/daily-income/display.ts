import { Coins, DollarSign, type LucideIcon } from "lucide-react";

export function getDailyIncomeCurrencyIcon(currency: string): LucideIcon {
  return currency.trim().toUpperCase() === "DOP" ? Coins : DollarSign;
}

export function formatDailyIncomeMoney(value: number, currency: string): string {
  const code = currency.trim().toUpperCase() === "DOP" ? "DOP" : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).format(value);
}

export function dailyIncomeCurrencyDescription(currency: string, rate: number): string | undefined {
  const code = currency.trim().toUpperCase() || "USD";
  if (code === "USD" && rate === 1) return undefined;
  if (rate !== 1) return `${code} · rate ${rate}`;
  return code;
}
