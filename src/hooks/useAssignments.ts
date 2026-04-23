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
import type { Assignment } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface AssignmentsFilters {
  complaintId?: string;
  employeeId?: string;
  limit?: number;
}

interface UseAssignmentsResult {
  data: Assignment[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/** Assignment audit trail. Server-side filters on complaintId or employeeId. */
export function useAssignments(filters: AssignmentsFilters | null): UseAssignmentsResult {
  const [data, setData] = useState<Assignment[]>([]);
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
      if (filters.complaintId) {
        constraints.push(where('complaintId', '==', filters.complaintId));
      }
      if (filters.employeeId) {
        constraints.push(where('employeeId', '==', filters.employeeId));
      }
      const cap = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('timestamp', 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'Assignments'), ...constraints);
      const snap = await getDocs(q);
      let rows: Assignment[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Assignment, 'id'>),
      }));

      // Defense-in-depth.
      if (filters.complaintId) rows = rows.filter((a) => a.complaintId === filters.complaintId);
      if (filters.employeeId) rows = rows.filter((a) => a.employeeId === filters.employeeId);

      setData(rows);
    } catch (e) {
      console.error('useAssignments failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
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

export default useAssignments;
