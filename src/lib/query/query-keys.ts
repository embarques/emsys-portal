export const queryKeys = {
  permissions: {
    all: ["permissions"] as const,
    user: () => [...queryKeys.permissions.all, "user"] as const,
  },
} as const;
