import { useState, useMemo, useEffect } from "react";

export interface UsePaginationOptions {
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

export interface UsePaginationReturn<T> {
  paginatedData: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
}

export function usePagination<T>(
  data: T[],
  options?: UsePaginationOptions
): UsePaginationReturn<T> {
  const pageSizeOptions = options?.pageSizeOptions || [20, 50, 100, 500];
  const [pageSize, setPageSize] = useState(options?.defaultPageSize || 20);
  const [page, setPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalItems, totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  );

  return {
    paginatedData,
    page,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    setPage,
    setPageSize: (size: number) => { setPageSize(size); },
    pageSizeOptions,
  };
}
