import { axiosInstance } from "@/lib/api/axios";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

const HEALTH_CHECK_TIMEOUT_MS = 10_000;

export async function fetchApiHealth(): Promise<{ ok: true }> {
  await axiosInstance.get(API_ENDPOINTS.HEALTH, {
    timeout: HEALTH_CHECK_TIMEOUT_MS,
  });

  return { ok: true };
}
