"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { hasAdminManagementAccess } from "@/lib/adminAccess";
import { useToast } from "@/context/ToastContext";
import type { Admin, AdminScope, AdminStatus, AccessLevel } from "@/types";

const STORAGE_KEY = "wasa_admin";

type StoredTimestamp = Timestamp | string | null;

interface StoredAdmin
  extends Omit<Admin, "createdAt" | "lastLogin"> {
  createdAt: StoredTimestamp;
  lastLogin: StoredTimestamp;
}

export interface AuthContextValue {
  admin: Admin | null;
  adminScope: AdminScope | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasFullAccess: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isTimestampLike = (value: unknown): value is Timestamp => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
};

const serializeTimestamp = (value: unknown): StoredTimestamp => {
  if (value === null || value === undefined) return null;
  if (isTimestampLike(value)) {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") return value;
  return null;
};

const serializeAdminForStorage = (admin: Admin): StoredAdmin => {
  return {
    ...admin,
    createdAt: serializeTimestamp(admin.createdAt),
    lastLogin: serializeTimestamp(admin.lastLogin),
  };
};

const parseStoredAdmin = (raw: string | null): Admin | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdmin> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.email || !parsed.accessLevel) return null;
    return parsed as unknown as Admin;
  } catch {
    return null;
  }
};

const adminFromSnapshot = (
  snap: DocumentSnapshot<DocumentData>
): Admin | null => {
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: (data.name as string) ?? "",
    email: (data.email as string) ?? "",
    phone: (data.phone as string) ?? "",
    password: (data.password as string) ?? "",
    accessLevel: (data.accessLevel as AccessLevel) ?? "tehsil",
    province: (data.province as string) ?? "Punjab",
    division: (data.division as string | null) ?? null,
    district: (data.district as string | null) ?? null,
    tehsil: (data.tehsil as string | null) ?? null,
    status: (data.status as AdminStatus) ?? "active",
    createdAt: data.createdAt as Admin["createdAt"],
    lastLogin: data.lastLogin as Admin["lastLogin"],
  };
};

const persistAdmin = (admin: Admin | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (!admin) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeAdminForStorage(admin))
    );
  } catch {
    // ignore persistence errors (quota, privacy mode)
  }
};

const readPersistedAdmin = (): Admin | null => {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredAdmin(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  const [admin, setAdmin] = useState<Admin | null>(() => readPersistedAdmin());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const listenerUnsubRef = useRef<Unsubscribe | null>(null);
  const listenerAdminIdRef = useRef<string | null>(null);
  const hasResolvedInitialRef = useRef<boolean>(false);

  const cleanupListener = useCallback(() => {
    if (listenerUnsubRef.current) {
      listenerUnsubRef.current();
      listenerUnsubRef.current = null;
    }
    listenerAdminIdRef.current = null;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    cleanupListener();
    try {
      await signOut(auth);
    } catch {
      // ignore — we still want to clear local state
    }
    persistAdmin(null);
    setAdmin(null);
    setError(null);
    setLoading(false);
    hasResolvedInitialRef.current = true;
  }, [cleanupListener]);

  // Realtime listener on the admin doc — reacts to status changes / deletion.
  useEffect(() => {
    const currentId = admin?.id ?? null;

    if (currentId === listenerAdminIdRef.current && listenerUnsubRef.current) {
      return;
    }

    cleanupListener();

    if (!currentId) {
      return;
    }

    listenerAdminIdRef.current = currentId;

    const unsub = onSnapshot(
      doc(db, "WasaAdmins", currentId),
      (snap) => {
        if (!snap.exists()) {
          toast.show({
            type: "error",
            title: "You have been signed out — account access changed.",
          });
          void logout();
          return;
        }
        const fresh = adminFromSnapshot(snap);
        if (!fresh) {
          toast.show({
            type: "error",
            title: "You have been signed out — account access changed.",
          });
          void logout();
          return;
        }
        if (fresh.status === "inactive") {
          toast.show({
            type: "error",
            title: "You have been signed out — account access changed.",
          });
          void logout();
          return;
        }
        setAdmin(fresh);
        persistAdmin(fresh);
        hasResolvedInitialRef.current = true;
        setLoading(false);
      },
      () => {
        // On listener error, best to log out to avoid stale auth
        void logout();
      }
    );

    listenerUnsubRef.current = unsub;
  }, [admin?.id, cleanupListener, logout, toast]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      cleanupListener();
    };
  }, [cleanupListener]);

  // Sync across tabs + resolve initial loading state.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        // No firebase user — ensure we're logged out locally too.
        if (admin) {
          cleanupListener();
          persistAdmin(null);
          setAdmin(null);
        }
        hasResolvedInitialRef.current = true;
        setLoading(false);
        return;
      }

      // Firebase user exists. If we have no admin record yet, the listener
      // will resolve it. If we already have an admin, the snapshot listener
      // above handles it. We only flip loading off once the snapshot has
      // resolved OR we're sure there's no admin to load.
      if (!admin) {
        hasResolvedInitialRef.current = true;
        setLoading(false);
      }
    });
    return () => unsub();
    // intentionally exclude `admin` — we only need to re-subscribe to auth once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setError(null);
      const normalizedEmail = email.toLowerCase().trim();
      try {
        await signInWithEmailAndPassword(auth, email, password);

        const adminsQuery = query(
          collection(db, "WasaAdmins"),
          where("email", "==", normalizedEmail),
          limit(1)
        );
        const snap = await getDocs(adminsQuery);

        if (snap.empty) {
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
          throw new Error("Admin record not found. Contact support.");
        }

        const docSnap = snap.docs[0];
        const parsed = adminFromSnapshot(docSnap);
        if (!parsed) {
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
          throw new Error("Admin record not found. Contact support.");
        }

        if (parsed.status === "inactive") {
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
          throw new Error("Your account is inactive.");
        }

        try {
          await updateDoc(doc(db, "WasaAdmins", docSnap.id), {
            lastLogin: serverTimestamp(),
          });
        } catch {
          // non-fatal: proceed even if lastLogin update fails
        }

        persistAdmin(parsed);
        setAdmin(parsed);
        hasResolvedInitialRef.current = true;
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Sign-in failed. Please try again.";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    []
  );

  const hasFullAccess = useMemo<boolean>(
    () => (admin ? hasAdminManagementAccess(admin.email) : false),
    [admin]
  );

  const adminScope = useMemo<AdminScope | null>(() => {
    if (!admin) return null;
    return {
      accessLevel: admin.accessLevel,
      province: admin.province || "Punjab",
      division: admin.division,
      district: admin.district,
      tehsil: admin.tehsil,
      fullAccess: hasFullAccess,
    };
  }, [admin, hasFullAccess]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      adminScope,
      isAuthenticated: !!admin,
      loading,
      error,
      login,
      logout,
      hasFullAccess,
    }),
    [admin, adminScope, loading, error, login, logout, hasFullAccess]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
