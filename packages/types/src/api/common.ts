export interface ApiSuccessResponse<TData> {
  status: "success";
  message: string;
  data: TData;
  meta?: Record<string, unknown>;
  requestId: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  status: "error";
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
  timestamp: string;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export interface PaginationQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
