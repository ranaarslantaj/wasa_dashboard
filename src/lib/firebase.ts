import {
  deleteApp,
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type Auth,
} from 'firebase/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Create a Firebase Auth user without disturbing the admin's primary session.
 *
 * Spins up a short-lived secondary Firebase app, calls `createUserWithEmailAndPassword`
 * on its isolated Auth instance, signs that instance out, and tears the app down.
 * Returns the new user's `uid` so callers can persist it on the corresponding
 * Firestore profile document.
 */
export const createAuthUserForEmployee = async (
  email: string,
  password: string,
): Promise<string> => {
  const secondaryName = `wasa-employee-bootstrap-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim().toLowerCase(),
      password,
    );
    await signOut(secondaryAuth).catch(() => {});
    return cred.user.uid;
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch {
      /* ignore — best effort cleanup */
    }
  }
};

/**
 * Normalize Firestore Timestamps, plain Date, or nullish values into a Date (or null).
 */
export const tsToDate = (t: Timestamp | Date | null | undefined): Date | null => {
  if (t === null || t === undefined) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof (t as Timestamp).toDate === 'function') {
    try {
      return (t as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
};
