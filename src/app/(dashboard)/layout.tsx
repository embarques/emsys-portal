import { DevSessionBanner } from "@/components/auth/dev-session-banner";
import { FeedbackProvider } from "@/components/app-shell/feedback-provider";
import { CalculatorProvider } from "@/components/app-shell/calculator-provider";
import { MemoPadProvider } from "@/components/app-shell/memo-pad-provider";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import { DashboardGuard } from "@/lib/auth/guards/dashboard-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <DevSessionBanner />
      <FeedbackProvider>
        <CalculatorProvider>
          <MemoPadProvider>
            <DashboardShell>{children}</DashboardShell>
          </MemoPadProvider>
        </CalculatorProvider>
      </FeedbackProvider>
    </DashboardGuard>
  );
}
