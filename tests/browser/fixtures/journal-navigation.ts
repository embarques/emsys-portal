export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    prefetch: async () => undefined,
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function usePathname() {
  return "/accounting/pending-financial-activity";
}
