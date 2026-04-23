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
import type { UnionCouncil } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface UCFilters {
  province?: string;
  district?: string;
  tehsil?: string;
}

interface UseUnionCouncilsResult {
  data: UnionCouncil[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const HARD_LIMIT = 1000;

/** Union Council lookup. Server-side filters on province/district/tehsil. */
export function useUnionCouncils(filters: UCFilters | null): UseUnionCouncilsResult {
  const [data, setData] = useState<UnionCouncil[]>([]);
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
      if (filters.province) constraints.push(where('province', '==', filters.province));
      if (filters.district) constraints.push(where('district', '==', filters.district));
      if (filters.tehsil) constraints.push(where('tehsil', '==', filters.tehsil));
      constraints.push(orderBy('name'));
      constraints.push(fsLimit(HARD_LIMIT));

      const q = query(collection(db, 'UnionCouncils'), ...constraints);
      const snap = await getDocs(q);
      let rows: UnionCouncil[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UnionCouncil, 'id'>),
      }));

      // Defense-in-depth client filter in case of missing composite indexes.
      if (filters.province) rows = rows.filter((u) => u.province === filters.province);
      if (filters.district) rows = rows.filter((u) => u.district === filters.district);
      if (filters.tehsil) rows = rows.filter((u) => u.tehsil === filters.tehsil);

      setData(rows);
    } catch (e) {
      console.error('useUnionCouncils failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load union councils');
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

export default useUnionCouncils;
