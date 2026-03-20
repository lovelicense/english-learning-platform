export type ApiResponse<T> = {
  data: T;
  requestId?: string;
};
