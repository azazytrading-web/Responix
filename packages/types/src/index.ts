export type ApiStatus = "success" | "error";

export interface RequestMetadata {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccessResponse<TData> extends RequestMetadata {
  status: "success";
  message: string;
  data: TData;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse extends RequestMetadata {
  status: "error";
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
}

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

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  roles: string[];
  permissions: string[];
}
