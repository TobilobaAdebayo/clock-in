'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/api-client';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Reusable hook for paginated API list endpoints (visitors, attendance, staff, audit logs, errors).
 */
export function usePaginatedQuery<T>(
  basePath: string,
  params: Record<string, string | number | undefined> = {},
  defaultLimit = 10,
) {
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: defaultLimit,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serializedParams = JSON.stringify(params);

  const fetchPage = useCallback(
    async (targetPage = page) => {
      try {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams({
          page: String(targetPage),
          limit: String(defaultLimit),
        });
        const parsed = JSON.parse(serializedParams) as Record<string, string | number | undefined>;
        Object.entries(parsed).forEach(([key, val]) => {
          if (val !== undefined && val !== '') {
            query.set(key, String(val));
          }
        });

        const res = await apiClient<T[]>(`${basePath}?${query.toString()}`);
        setData(res.data || []);
        if ((res as any).meta) {
          setMeta((res as any).meta);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    },
    [basePath, defaultLimit, page, serializedParams],
  );

  useEffect(() => {
    setPage(1);
  }, [serializedParams]);

  useEffect(() => {
    fetchPage(page);
  }, [fetchPage, page]);

  return {
    data,
    meta,
    page,
    setPage,
    loading,
    error,
    refresh: () => fetchPage(page),
  };
}
