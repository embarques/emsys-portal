import { cn } from "@/lib/utils";

type NavAlertBadgeProps = {
  count: number;
  label: string;
  className?: string;
};

export function NavAlertBadge({ count, label, className }: NavAlertBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={label}
      className={cn(
        "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
