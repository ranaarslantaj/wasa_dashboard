import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Admin } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface AdminsFilters {
  activeOnly?: boolean;
  limit?: number;
}

interface UseAdminsResult {
  data: Admin[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_LIMIT = 1000;

/** Admin accounts hook (super-admin Admin Management page). */
export function useAdmins(filters: AdminsFilters | null): UseAdminsResult {
  const [data, setData] = useState<Admin[]>([]);
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
      if (filters.activeOnly) {
        constraints.push(where('status', '==', 'active'));
      }
      const cap = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'WasaAdmins'), ...constraints);
      const snap = await getDocs(q);
      let rows: Admin[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Admin, 'id'>),
      }));

      if (filters.activeOnly) {
        rows = rows.filter((a) => a.status === 'active');
      }

      setData(rows);
    } catch (e) {
      console.error('useAdmins failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load admins');
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

export default useAdmins;
