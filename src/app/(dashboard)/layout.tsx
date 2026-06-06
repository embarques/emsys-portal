import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import { FeedbackProvider } from "@/components/app-shell/feedback-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <DashboardShell>{children}</DashboardShell>
    </FeedbackProvider>
  );
}
