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
 * Campaigns collection shape (super-admin managed). Types live here because the
 * project's `@/types` barrel does not (yet) export a Campaign interface. Adjust
 * freely when the shared type is introduced.
 */
export interface Campaign {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  active: boolean;
  startDate?: Timestamp | null;
  endDate?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: unknown;
}

export interface CampaignsFilters {
  activeOnly?: boolean;
  limit?: number;
}

interface UseCampaignsResult {
  data: Campaign[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/** Campaigns hook for the super-admin Campaigns page. */
export function useCampaigns(filters: CampaignsFilters | null): UseCampaignsResult {
  const [data, setData] = useState<Campaign[]>([]);
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
      const cap = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(fsLimit(cap));

      const q = query(collection(db, 'Campaigns'), ...constraints);
      const snap = await getDocs(q);
      let rows: Campaign[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<Campaign, 'id'>),
        id: d.id,
      })) as Campaign[];

      if (filters.activeOnly) {
        rows = rows.filter((c) => c.active === true);
      }

      setData(rows);
    } catch (e) {
      console.error('useCampaigns failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
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

export default useCampaigns;
