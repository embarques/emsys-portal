import { FeedbackProvider } from "@/components/app-shell/feedback-provider";
import { CalculatorProvider } from "@/components/app-shell/calculator-provider";
import { MemoPadProvider } from "@/components/app-shell/memo-pad-provider";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <CalculatorProvider>
        <MemoPadProvider>
          <DashboardShell>{children}</DashboardShell>
        </MemoPadProvider>
      </CalculatorProvider>
    </FeedbackProvider>
  );
}
