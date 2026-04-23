import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { noop, stableStringify } from './_useFirestoreQuery';

/**
 * News collection shape (super-admin managed). Kept local for the same reason as
 * the Campaign interface — no shared type exported from `@/types` yet.
 */
export interface NewsItem {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  published: boolean;
  publishedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: unknown;
}

export interface NewsFilters {
  publishedOnly?: boolean;
  limit?: number;
}

interface UseNewsResult {
  data: NewsItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/** News hook for the super-admin News page. */
export function useNews(filters: NewsFilters | null): UseNewsResult {
  const [data, setData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const prevFiltersRef = useRef<string>('');
  const refetchCounterRef = useRef<number>(0);

  const run = useCallback(async () => {
    if (!filters) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const constraints: QueryConstraint[] = [];
      if (filters.publishedOnly) {
        constraints.push(where('published', '==', true));
      }
      const cap = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('publishedAt', 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'News'), ...constraints);
      const snap = await getDocs(q);
      let rows: NewsItem[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<NewsItem, 'id'>),
        id: d.id,
      })) as NewsItem[];

      if (filters.publishedOnly) {
        rows = rows.filter((n) => n.published === true);
      }

      setData(rows);
    } catch (e) {
      console.error('useNews failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load news');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!filters) {
      prevFiltersRef.current = 'null';
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    const key = stableStringify(filters);
    if (key === prevFiltersRef.current && refetchCounterRef.current === 0) return;
    prevFiltersRef.current = key;
    run();
  }, [filters, run]);

  const refetch = useCallback(() => {
    if (!filters) return;
    refetchCounterRef.current += 1;
    run();
  }, [filters, run]);

  if (!filters) {
    return { data: [], loading: false, error: null, refetch: noop };
  }

  return { data, loading, error, refetch };
}

export default useNews;
