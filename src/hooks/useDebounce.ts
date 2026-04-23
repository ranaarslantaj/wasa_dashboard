import { useEffect, useState } from 'react';

/**
 * Generic debounce hook. Returns the latest `value` after `delay` ms have elapsed
 * with no new updates. Cancels pending timers on unmount / value change.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
