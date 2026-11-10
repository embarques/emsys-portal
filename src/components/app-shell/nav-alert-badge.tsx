import { cn } from "@/lib/utils";

type NavAlertBadgeProps = {
  count: number;
  label: string;
  /** `alert` (red) flags work needing action; `count` (green) is informational. */
  tone?: "alert" | "count";
  className?: string;
};

export function NavAlertBadge({ count, label, tone = "alert", className }: NavAlertBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={label}
      className={cn(
        "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
        tone === "count" ? "bg-emerald-600" : "bg-red-500",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
