/** Standard emsys-api paginated list envelope. */
export type PaginatedApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  duration?: number;
  page?: number;
  resultsPerPage?: number;
  total?: number;
  subtotal?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  resultsPerPage: number;
  total: number;
};
