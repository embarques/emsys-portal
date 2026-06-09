"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { addedMessage, deletedMessage, errorMessage, updatedMessage } from "@/lib/feedback/messages";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type FeedbackContextValue = {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyAdded: (entityLabel: string, name?: string) => void;
  notifyUpdated: (entityLabel: string, name?: string) => void;
  notifyDeleted: (entityLabel: string, count?: number) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const notifySuccess = useCallback((message: string) => {
    pushToast(message, "success");
  }, [pushToast]);

  const notifyError = useCallback((message: string) => {
    pushToast(errorMessage(message), "error");
  }, [pushToast]);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notifySuccess,
      notifyError,
      notifyAdded: (entityLabel, name) => notifySuccess(addedMessage(entityLabel, name)),
      notifyUpdated: (entityLabel, name) => notifySuccess(updatedMessage(entityLabel, name)),
      notifyDeleted: (entityLabel, count) => notifySuccess(deletedMessage(entityLabel, count)),
    }),
    [notifyError, notifySuccess]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            message={toast.message}
            tone={toast.tone}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

function ToastCard({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: ToastTone;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-background p-4 shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        tone === "error" && "border-destructive/30",
      )}
      role="status"
      aria-live="polite"
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      )}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}
