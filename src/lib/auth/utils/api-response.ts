/** Standard emsys-api success envelope (`internal/responses.Success`). */
export type ApiSuccessEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export function unwrapApiData<T>(response: T | ApiSuccessEnvelope<T>): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as ApiSuccessEnvelope<T>).data != null
  ) {
    return (response as ApiSuccessEnvelope<T>).data as T;
  }

  return response as T;
}
