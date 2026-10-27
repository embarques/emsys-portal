import { z } from "zod";

import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

const versionResponseSchema = z.object({
  data: z.object({ version: z.string().trim().min(1) }),
});

export async function fetchApiVersion(signal: AbortSignal): Promise<string> {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.VERSION, { signal });
  return versionResponseSchema.parse(response).data.version;
}
