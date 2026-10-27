import { isAxiosError } from "axios";

/** Other conflicts, including duplicate payment warnings, cannot trigger rollover. */
export function isCloseoutRequired(error: unknown): boolean {
  return isAxiosError(error)
    && error.response?.status === 409
    && error.response.data?.data?.code === "CLOSEOUT_REQUIRED";
}
