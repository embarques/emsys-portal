export const apiClient = {
  post: async (_url: string, payload: unknown) => {
    (window as unknown as { savedRoute: unknown }).savedRoute = payload;
    return { success: true, data: { id: 15, ...(payload as object) } };
  },
};
