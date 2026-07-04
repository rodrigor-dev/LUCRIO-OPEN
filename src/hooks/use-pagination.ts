import { useState, useCallback, useMemo } from "react";

interface UsePaginationOptions {
  itemsPerPage?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  paginatedItems: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageItems: (items: T[]) => void;
  totalItems: number;
}

export function usePagination<T>(options?: UsePaginationOptions): UsePaginationReturn<T> {
  const itemsPerPage = options?.itemsPerPage || 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [allItems, setAllItems] = useState<T[]>([]);

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allItems.slice(start, start + itemsPerPage);
  }, [allItems, currentPage, itemsPerPage]);

  const setPageItems = useCallback((items: T[]) => {
    setAllItems(items);
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 1));
  }, []);

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    setPageItems,
    totalItems,
  };
}
