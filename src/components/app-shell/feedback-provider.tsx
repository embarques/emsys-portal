"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { addedMessage, deletedMessage, errorMessage, updatedMessage } from "@/lib/feedback/messages";
import { cn } from "@/lib/utils";
import { createRandomId } from "@/lib/utils/id";

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
    const id = createRandomId();
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
      <div className="pointer-events-none fixed right-4 top-4 z-[300] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
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
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-sm",
        "animate-in slide-in-from-top-4 fade-in duration-300",
        tone === "success" &&
          "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50",
        tone === "error" &&
          "border-destructive/50 bg-red-50 text-destructive dark:border-destructive/60 dark:bg-red-950/95 dark:text-red-50",
      )}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive dark:text-red-300" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "rounded-md p-1 transition-colors",
          tone === "success" &&
            "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900",
          tone === "error" && "text-destructive hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900",
        )}
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
