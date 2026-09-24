export interface ApiResponse<T> {
  status: "success" | "error";
  data: T | null;
  message: string | null;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
