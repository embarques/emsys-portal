"use client";

import { ApiUnavailableBanner } from "@/components/app-shell/api-unavailable-banner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/auth-provider";
import { I18nProvider } from "@/lib/i18n";
import { QueryProvider } from "@/providers/query-provider";
import { ReduxProvider } from "@/providers/redux-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ReduxProvider>
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <TooltipProvider delayDuration={200}>
                <ApiUnavailableBanner />
                {children}
              </TooltipProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </ReduxProvider>
    </QueryProvider>
  );
}
