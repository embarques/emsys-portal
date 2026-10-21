const noop = () => {};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useFeedback() {
  return new Proxy({}, { get: () => noop }) as Record<string, (...args: unknown[]) => void>;
}
