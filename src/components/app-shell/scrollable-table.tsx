import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ScrollableTable({
  children,
  className,
  minWidth = 960,
}: {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <CardContent className={cn("overflow-x-auto p-0", className)}>
      <div style={{ minWidth }}>{children}</div>
    </CardContent>
  );
}
