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
import type { WasaEmployee } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface EmployeesFilters {
  scopeDistricts: string[];
  district?: string;
  tehsil?: string;
  department?: string;
  specialization?: string;
  activeOnly?: boolean;
  limit?: number;
}

interface UseWasaEmployeesResult {
  data: WasaEmployee[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_LIMIT = 1000;
const FIRESTORE_IN_MAX = 10;

/**
 * WASA employee data hook. Server-side filters on district scope, department, active flag.
 * Tehsil and specialization are applied client-side (specialization is a string[] and Firestore
 * can't combine array-contains-any with an `in` on another field in a single query).
 */
export function useWasaEmployees(filters: EmployeesFilters | null): UseWasaEmployeesResult {
  const [data, setData] = useState<WasaEmployee[]>([]);
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

      if (filters.district) {
        constraints.push(where('district', '==', filters.district));
      } else if (
        filters.scopeDistricts.length > 0 &&
        filters.scopeDistricts.length <= FIRESTORE_IN_MAX
      ) {
        constraints.push(where('district', 'in', filters.scopeDistricts));
      }

      if (filters.department) {
        constraints.push(where('department', '==', filters.department));
      }
      if (filters.activeOnly) {
        constraints.push(where('active', '==', true));
      }

      const cap = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('name'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'WasaEmployees'), ...constraints);
      const snap = await getDocs(q);
      let rows: WasaEmployee[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WasaEmployee, 'id'>),
      }));

      // Defense-in-depth scope filter.
      if (filters.scopeDistricts.length > 0) {
        const allowed = new Set(filters.scopeDistricts);
        rows = rows.filter((e) => (e.district ? allowed.has(e.district) : false));
      }
      if (filters.district) {
        rows = rows.filter((e) => e.district === filters.district);
      }
      if (filters.tehsil) {
        rows = rows.filter((e) => e.tehsil === filters.tehsil);
      }
      if (filters.specialization) {
        rows = rows.filter(
          (e) => Array.isArray(e.specialization) && e.specialization.includes(filters.specialization as string),
        );
      }
      if (filters.activeOnly) {
        rows = rows.filter((e) => e.active === true);
      }

      setData(rows);
    } catch (e) {
      console.error('useWasaEmployees failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load employees');
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

export default useWasaEmployees;
