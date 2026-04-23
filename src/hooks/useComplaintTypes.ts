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
import { SEED_COMPLAINT_TYPES } from '@/constants/complaintTypes';
import type { ComplaintType } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface ComplaintTypesFilters {
  activeOnly?: boolean;
}

interface UseComplaintTypesResult {
  data: ComplaintType[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const HARD_LIMIT = 100;

/** Build a synthetic ComplaintType list from the seed constant (used as a fallback
 *  so the UI renders before the Firestore collection is populated). */
const buildSeedFallback = (activeOnly?: boolean): ComplaintType[] => {
  const seeded: ComplaintType[] = SEED_COMPLAINT_TYPES.map((t, idx) => ({
    id: `seed-${t.key}-${idx}`,
    ...t,
  }));
  return activeOnly ? seeded.filter((t) => t.active) : seeded;
};

/**
 * Complaint type catalog hook. Falls back to `SEED_COMPLAINT_TYPES` when the `ComplaintTypes`
 * collection is empty so the UI never renders an empty dropdown.
 */
export function useComplaintTypes(
  filters: ComplaintTypesFilters | null = {},
): UseComplaintTypesResult {
  const [data, setData] = useState<ComplaintType[]>([]);
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
        constraints.push(where('active', '==', true));
      }
      constraints.push(orderBy('sortOrder'));
      constraints.push(fsLimit(HARD_LIMIT));

      const q = query(collection(db, 'ComplaintTypes'), ...constraints);
      const snap = await getDocs(q);

      if (snap.empty) {
        // Spec §2.4: seed fallback so UI never breaks before the collection is populated.
        setData(buildSeedFallback(filters.activeOnly));
        return;
      }

      let rows: ComplaintType[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ComplaintType, 'id'>),
      }));
      if (filters.activeOnly) {
        rows = rows.filter((t) => t.active === true);
      }
      setData(rows);
    } catch (e) {
      console.error('useComplaintTypes failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load complaint types');
      // Still provide the seed fallback so the UI remains functional on error.
      setData(buildSeedFallback(filters.activeOnly));
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

export default useComplaintTypes;
