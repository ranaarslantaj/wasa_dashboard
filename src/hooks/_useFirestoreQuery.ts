/**
 * Shared helpers for Firestore data hooks.
 *
 * Per spec §10 (Hook Patterns — Performance Critical) and §19 non-negotiable rules:
 *  - All hooks use `getDocs` (one-time). NEVER `onSnapshot` — NotificationContext is the only
 *    place that uses realtime listeners (rule 6).
 *  - Every hook caps results with `limit(1000)` max (rule 5). (Some hooks cap lower.)
 *  - `prevFiltersRef` is keyed with `stableStringify` to dedupe fetches when filters are
 *    structurally equal (handles Date objects, nested arrays, key ordering).
 */
export const stableStringify = (obj: unknown): string => {
  if (obj === null || obj === undefined) return 'null';
  if (obj instanceof Date) return JSON.stringify(obj.toISOString());
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`)
    .join(',')}}`;
};

/** No-op refetch used when a hook is disabled (filters === null). */
export const noop = (): void => {
  /* intentionally empty */
};
