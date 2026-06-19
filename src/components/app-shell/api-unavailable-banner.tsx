"use client";

import { AlertCircle } from "lucide-react";

import {
  useApiConnectivityMessage,
  useApiHealth,
} from "@/lib/api/hooks/use-api-health";

export function ApiUnavailableBanner() {
  const { isError, error, isPending } = useApiHealth();
  const message = useApiConnectivityMessage(isError ? error : null);

  if (isPending || !message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive dark:text-red-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <strong>API unavailable.</strong> {message}
      </p>
    </div>
  );
}
