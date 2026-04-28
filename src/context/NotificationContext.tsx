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
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getDistrictsForDivision } from "@/constants/geography";
import type { AppNotification } from "@/types";

const MUTE_STORAGE_KEY = "wasa_notif_mute";
const MAX_NOTIFICATIONS = 50;
const LOOKBACK_MS = 2 * 60 * 60 * 1000; // 2 hours
const TOAST_DEBOUNCE_MS = 500;

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  mute: boolean;
  setMute: (v: boolean) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

const readPersistedMute = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const persistMute = (v: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, v ? "1" : "0");
  } catch {
    // ignore
  }
};

interface ComplaintDocData {
  complaintId?: string;
  complaintType?: string;
  ucName?: string;
  tehsil?: string;
  tahsil?: string;
  district?: string;
  priority?: string;
  status?: string;
  createdAt?: Timestamp;
}

const buildNotification = (
  docId: string,
  data: ComplaintDocData
): AppNotification | null => {
  const createdAtTs = data.createdAt;
  if (!createdAtTs || typeof createdAtTs.toDate !== "function") {
    return null;
  }
  const locationLabel =
    data.ucName || data.tehsil || data.tahsil || "unknown location";
  const typeLabel = data.complaintType || "Complaint";
  return {
    id: docId,
    complaintId: data.complaintId || docId,
    title: "New complaint submitted",
    message: `${typeLabel} at ${locationLabel}`,
    createdAt: createdAtTs.toDate(),
    read: false,
    data: {
      priority: data.priority,
      status: data.status,
      district: data.district,
      tehsil: data.tehsil || data.tahsil,
    },
  };
};

const playTwoToneBeep = (): void => {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number): void => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    playTone(880, now, 0.08);
    playTone(1320, now + 0.09, 0.08);

    // Close context after the sequence finishes to free resources.
    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 400);
  } catch {
    // audio failures are non-fatal
  }
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { admin, adminScope } = useAuth();
  const toast = useToast();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [mute, setMuteState] = useState<boolean>(() => readPersistedMute());

  const firstSnapshotRef = useRef<boolean>(true);
  const pendingToastRef = useRef<AppNotification[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const muteRef = useRef<boolean>(mute);

  // Keep a ref in sync so debounced timer reads the latest value.
  useEffect(() => {
    muteRef.current = mute;
  }, [mute]);

  const setMute = useCallback((v: boolean): void => {
    setMuteState(v);
    persistMute(v);
  }, []);

  const markAsRead = useCallback((id: string): void => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback((): void => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback((): void => {
    setNotifications([]);
  }, []);

  const flushPendingToast = useCallback((): void => {
    const pending = pendingToastRef.current;
    pendingToastRef.current = [];
    toastTimerRef.current = null;

    if (pending.length === 0) return;
    if (muteRef.current) return;

    // Most recent first (by createdAt desc).
    const sorted = [...pending].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const latest = sorted[0];

    if (pending.length === 1) {
      toast.show({
        type: "info",
        title: latest.title,
        description: latest.message,
      });
    } else {
      toast.show({
        type: "info",
        title: `${pending.length} new complaints`,
        description: `Most recent: ${latest.message}`,
      });
    }

    playTwoToneBeep();
  }, [toast]);

  const queueToast = useCallback(
    (items: AppNotification[]): void => {
      if (items.length === 0) return;
      pendingToastRef.current = [...pendingToastRef.current, ...items];
      if (toastTimerRef.current !== null) return;
      if (typeof window === "undefined") return;
      toastTimerRef.current = window.setTimeout(
        flushPendingToast,
        TOAST_DEBOUNCE_MS
      );
    },
    [flushPendingToast]
  );

  useEffect(() => {
    // No admin = no listener. Also reset state.
    if (!admin) {
      setNotifications([]);
      firstSnapshotRef.current = true;
      pendingToastRef.current = [];
      if (toastTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      return;
    }

    firstSnapshotRef.current = true;

    const cutoff = Timestamp.fromDate(new Date(Date.now() - LOOKBACK_MS));
    const q = query(
      collection(db, "Complaints"),
      where("complainType", "==", "manhole"),
      where("departmentType", "==", "wasa"),
      where("createdAt", ">=", cutoff),
      orderBy("createdAt", "desc"),
      limit(MAX_NOTIFICATIONS)
    );

    const scope = adminScope;

    const passesScope = (data: ComplaintDocData): boolean => {
      const reportDistrict = data.district || "";
      const reportTehsil = data.tehsil || data.tahsil || "";
      if (scope && !scope.fullAccess && scope.accessLevel !== "province") {
        if (scope.accessLevel === "division" && scope.division) {
          const divisionDistricts = getDistrictsForDivision(scope.division);
          if (
            !reportDistrict ||
            !divisionDistricts.includes(reportDistrict)
          ) {
            return false;
          }
        }
        if (scope.accessLevel === "district") {
          if (!scope.district || reportDistrict !== scope.district) {
            return false;
          }
        }
        if (scope.accessLevel === "tehsil") {
          if (!scope.district || reportDistrict !== scope.district) {
            return false;
          }
          if (!scope.tehsil || reportTehsil !== scope.tehsil) {
            return false;
          }
        }
      }
      return true;
    };

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const isFirst = firstSnapshotRef.current;

        if (isFirst) {
          const initial: AppNotification[] = [];
          snap.docs.forEach(
            (docSnap: QueryDocumentSnapshot<DocumentData>) => {
              const data = docSnap.data() as ComplaintDocData;
              if (!passesScope(data)) return;
              const notif = buildNotification(docSnap.id, data);
              if (notif) initial.push(notif);
            }
          );
          setNotifications(initial.slice(0, MAX_NOTIFICATIONS));
          firstSnapshotRef.current = false;
          return;
        }

        const added: AppNotification[] = [];
        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const data = change.doc.data() as ComplaintDocData;
          if (!passesScope(data)) return;
          const notif = buildNotification(change.doc.id, data);
          if (notif) added.push(notif);
        });

        if (added.length === 0) return;

        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const fresh = added.filter((n) => !existingIds.has(n.id));
          if (fresh.length === 0) return prev;
          return [...fresh, ...prev].slice(0, MAX_NOTIFICATIONS);
        });

        queueToast(added);
      },
      () => {
        // Listener error: best to leave existing state intact.
      }
    );

    return () => {
      unsub();
      if (toastTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      pendingToastRef.current = [];
      firstSnapshotRef.current = true;
    };
  }, [admin, adminScope, queueToast]);

  const unreadCount = useMemo<number>(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearAll,
      mute,
      setMute,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead, clearAll, mute, setMute]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return ctx;
};

/**
 * Non-throwing variant: returns null if the provider isn't mounted.
 * Use this in components that may render outside the notification provider tree.
 */
export const useNotificationsOptional = (): NotificationContextValue | null => {
  const ctx = useContext(NotificationContext);
  return ctx ?? null;
};
