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

import { db, tsToDate } from '@/lib/firebase';
import type { Complaint } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface ComplaintsFilters {
  /** Districts allowed by admin scope. `[]` means "no filter" (province / super-admin). */
  scopeDistricts: string[];
  district?: string;
  tehsil?: string;
  uc?: string;
  complaintType?: string;
  status?: string;
  priority?: string;
  /** Employee uid (WasaEmployees.uid). */
  assignee?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  /** Client-side free-text search against name/phone/complaintId/description. */
  search?: string;
  /** Hard cap. Default 1000. Must never exceed 1000 per spec §19 rule 5. */
  limit?: number;
}

interface UseComplaintsResult {
  data: Complaint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_LIMIT = 1000;
/** Firestore `in` operator supports at most 10 values. */
const FIRESTORE_IN_MAX = 10;

/**
 * Primary complaint data hook. Server-side filters on district/status/complaintType/assignee;
 * client-side filters for tehsil/uc/priority/date-range/search and defense-in-depth scope check.
 *
 * Pass `filters = null` to disable the hook (returns empty immediately — no Firestore call).
 */
export function useComplaints(filters: ComplaintsFilters | null): UseComplaintsResult {
  const [data, setData] = useState<Complaint[]>([]);
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

      // --- Server-side scope filter ---
      // Prefer single-district equality when the UI has narrowed to one; otherwise use
      // scopeDistricts via `in` (max 10). If scope has >10 districts, skip server-side
      // and rely on the client filter below.
      let scopeFilteredServerSide = false;
      if (filters.district) {
        constraints.push(where('district', '==', filters.district));
        scopeFilteredServerSide = true;
      } else if (
        filters.scopeDistricts.length > 0 &&
        filters.scopeDistricts.length <= FIRESTORE_IN_MAX
      ) {
        constraints.push(where('district', 'in', filters.scopeDistricts));
        scopeFilteredServerSide = true;
      }

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters.complaintType) {
        constraints.push(where('complaintType', '==', filters.complaintType));
      }
      if (filters.assignee) {
        constraints.push(where('assignedTo', '==', filters.assignee));
      }

      const cap = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'Complaints'), ...constraints);
      const snap = await getDocs(q);
      let rows: Complaint[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Complaint, 'id'>),
      }));

      // --- Client-side filters ---
      // Defense-in-depth: always re-apply scope filter when we have scope districts.
      if (filters.scopeDistricts.length > 0) {
        const allowed = new Set(filters.scopeDistricts);
        rows = rows.filter((c) => (c.district ? allowed.has(c.district) : false));
      }
      // If user narrowed district but somehow server-side was skipped, enforce it.
      if (filters.district && !scopeFilteredServerSide) {
        rows = rows.filter((c) => c.district === filters.district);
      }
      if (filters.tehsil) {
        rows = rows.filter((c) => c.tehsil === filters.tehsil);
      }
      if (filters.uc) {
        rows = rows.filter((c) => c.ucId === filters.uc || c.ucName === filters.uc);
      }
      if (filters.priority) {
        rows = rows.filter((c) => c.priority === filters.priority);
      }

      // Date range on createdAt (convert Timestamp -> Date safely).
      if (filters.dateFrom || filters.dateTo) {
        const from = filters.dateFrom ? filters.dateFrom.getTime() : -Infinity;
        const to = filters.dateTo ? filters.dateTo.getTime() : Infinity;
        rows = rows.filter((c) => {
          const createdAt = tsToDate(c.createdAt);
          if (!createdAt) return false;
          const t = createdAt.getTime();
          return t >= from && t <= to;
        });
      }

      // Free-text search (case-insensitive) across common fields.
      if (filters.search && filters.search.trim().length > 0) {
        const needle = filters.search.trim().toLowerCase();
        rows = rows.filter((c) => {
          const hay = [
            c.complainantName,
            c.complainantPhone,
            c.complaintId,
            c.description,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(needle);
        });
      }

      setData(rows);
    } catch (e) {
      console.error('useComplaints failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load complaints');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!filters) {
      // Disabled: reset state immediately, do not fetch.
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

export default useComplaints;
