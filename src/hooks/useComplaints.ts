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
import type { Complaint, ComplaintStatus, RoutingStrategy } from '@/types';
import { noop, stableStringify } from './_useFirestoreQuery';

export interface ComplaintsFilters {
  /** Districts allowed by admin scope. `[]` means "no filter" (province / super-admin). */
  scopeDistricts: string[];
  district?: string;
  /** Tahsil — schema spelling. UI may pass either "tehsil" or "tahsil"; we match the document's `tahsil`. */
  tahsil?: string;
  uc?: string;
  /** WASA sub-category (the "type" filter from the user's perspective). */
  wasaCategory?: string;
  complaintStatus?: ComplaintStatus;
  routingStrategy?: RoutingStrategy;
  /** When true, only fetch unassigned (server-side `where('assignedTo','==',null)`). */
  onlyUnassigned?: boolean;
  /** Employee uid (WasaEmployees.uid). */
  assignee?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  /** Client-side free-text search across name/phone/complaintId/description/address. */
  search?: string;
  /** Hard cap. Default 1000. Must never exceed 1000 per spec §19. */
  limit?: number;
  /** 'newest' (default) sorts createdAt desc; 'oldest' sorts asc — used by Pending Queue. */
  sort?: 'newest' | 'oldest';
}

interface UseComplaintsResult {
  data: Complaint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_LIMIT = 1000;
const FIRESTORE_IN_MAX = 10;

/**
 * Primary complaint data hook for the WASA admin dashboard.
 *
 * Always pins `complainType == 'manhole'` AND `departmentType == 'wasa'` server-side so the
 * dashboard never sees citizen-app dog complaints. Pass `filters = null` to disable.
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

      // Pin to manhole + wasa — non-negotiable for this dashboard.
      constraints.push(where('complainType', '==', 'manhole'));
      constraints.push(where('departmentType', '==', 'wasa'));

      // Server-side scope filter.
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

      if (filters.complaintStatus) {
        constraints.push(where('complaintStatus', '==', filters.complaintStatus));
      }
      if (filters.wasaCategory) {
        constraints.push(where('wasaCategory', '==', filters.wasaCategory));
      }
      if (filters.routingStrategy) {
        constraints.push(where('routingStrategy', '==', filters.routingStrategy));
      }
      if (filters.assignee) {
        constraints.push(where('assignedTo', '==', filters.assignee));
      } else if (filters.onlyUnassigned) {
        constraints.push(where('assignedTo', '==', null));
      }

      const cap = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('createdAt', filters.sort === 'oldest' ? 'asc' : 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'Complaints'), ...constraints);
      const snap = await getDocs(q);
      let rows: Complaint[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<Complaint, 'id'>),
        id: d.id,
      })) as Complaint[];

      // Defense-in-depth scope re-filter.
      if (filters.scopeDistricts.length > 0) {
        const allowed = new Set(filters.scopeDistricts);
        rows = rows.filter((c) => (c.district ? allowed.has(c.district) : false));
      }
      if (filters.district && !scopeFilteredServerSide) {
        rows = rows.filter((c) => c.district === filters.district);
      }
      if (filters.tahsil) {
        rows = rows.filter((c) => c.tahsil === filters.tahsil);
      }
      if (filters.uc) {
        rows = rows.filter((c) => c.ucId === filters.uc || c.ucMcNumber === filters.uc);
      }

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

      if (filters.search && filters.search.trim().length > 0) {
        const needle = filters.search.trim().toLowerCase();
        rows = rows.filter((c) => {
          const hay = [
            c.complainantName,
            c.complainantPhone,
            c.complaintId,
            c.description,
            c.address,
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
