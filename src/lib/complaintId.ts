import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Generates a human-readable complaint ID in the format `WASA-YYYY-NNNNN`,
 * using a per-year Firestore counter at `Counters/complaints_{YYYY}`.
 */
export const generateComplaintId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'Counters', `complaints_${year}`);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const n = current + 1;
    tx.set(counterRef, { value: n, year }, { merge: true });
    return n;
  });
  return `WASA-${year}-${String(next).padStart(5, '0')}`;
};
