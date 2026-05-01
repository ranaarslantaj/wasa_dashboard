import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../components/Toast';
import { useAuth } from './AuthContext';
import { getDistrictsForDivision } from '../constants';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const toast = useToast();
  const { adminScope } = useAuth();

  // All mutable refs in one object to minimize overhead
  const refs = useRef({
    isFirstSnapshot: true,
    processedIds: new Set(),
    toast: null,
    pendingNotifications: [],
    debounceTimer: null,
    adminScope: null
  });

  // Keep toast ref updated
  refs.current.toast = toast;
  // Keep adminScope ref updated for use inside snapshot handler
  refs.current.adminScope = adminScope;

  // Play notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create a pleasant notification sound
      const playTone = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      // Two-tone notification sound
      playTone(880, now, 0.15);        // A5
      playTone(1108.73, now + 0.15, 0.2); // C#6

      // Close audio context after sound plays
      setTimeout(() => audioContext.close(), 500);
    } catch (e) {
      // Web Audio not supported
    }
  }, []);

  // Batch and show notifications (debounced)
  const flushNotifications = useCallback(() => {
    const pending = refs.current.pendingNotifications;
    if (pending.length === 0) return;

    // Add all pending to state in one update
    setNotifications(prev => {
      const newNotifications = pending.filter(n => !prev.some(p => p.id === n.id));
      if (newNotifications.length === 0) return prev;
      return [...newNotifications, ...prev].slice(0, 50);
    });

    setUnreadCount(prev => prev + pending.length);

    // Show toast for latest only (avoid spam)
    if (pending.length === 1) {
      refs.current.toast?.info(pending[0].message, pending[0].title);
    } else {
      refs.current.toast?.info(`${pending.length} new reports received`, 'New Reports');
    }

    // Play notification sound
    playNotificationSound();

    // Clear pending
    refs.current.pendingNotifications = [];
  }, [playNotificationSound]);

  // Queue notification with debounce
  const queueNotification = useCallback((notification) => {
    refs.current.pendingNotifications.push(notification);

    // Debounce: wait 500ms for more notifications before showing
    if (refs.current.debounceTimer) {
      clearTimeout(refs.current.debounceTimer);
    }
    refs.current.debounceTimer = setTimeout(flushNotifications, 500);
  }, [flushNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Mark single as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => {
      const idx = prev.findIndex(n => n.id === id && !n.read);
      if (idx === -1) return prev;
      setUnreadCount(c => Math.max(0, c - 1));
      const updated = [...prev];
      updated[idx] = { ...updated[idx], read: true };
      return updated;
    });
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Real-time listener - stable, runs once
  useEffect(() => {
    // Reset state on mount (handles HMR/Strict Mode)
    refs.current.isFirstSnapshot = true;
    refs.current.processedIds.clear();

    // Query only last 2 hours to minimize reads
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const q = query(
      collection(db, 'DogCullingReports'),
      where('timestamp', '>=', twoHoursAgo),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Skip if from cache only (no server data yet)
      if (snapshot.metadata.fromCache && refs.current.isFirstSnapshot) {
        return;
      }

      // First snapshot: record existing IDs only
      if (refs.current.isFirstSnapshot) {
        snapshot.docs.forEach(doc => refs.current.processedIds.add(doc.id));
        refs.current.isFirstSnapshot = false;
        return;
      }

      // Process only new additions
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;

        const docId = change.doc.id;
        if (refs.current.processedIds.has(docId)) return;

        refs.current.processedIds.add(docId);

        const data = change.doc.data();

        // Filter by admin scope - only show notifications for scoped data
        const scope = refs.current.adminScope;
        if (scope && scope.accessLevel !== 'province') {
          const reportDistrict = data.district || '';
          const reportTahsil = data.tahsil || '';

          if (scope.accessLevel === 'division' && scope.division) {
            const divisionDistricts = getDistrictsForDivision(scope.division);
            if (!reportDistrict || !divisionDistricts.includes(reportDistrict)) return;
          }

          if (scope.accessLevel === 'district') {
            if (!scope.district || reportDistrict !== scope.district) return;
          }

          if (scope.accessLevel === 'tehsil') {
            if (!scope.district || reportDistrict !== scope.district) return;
            if (!scope.tehsil || reportTahsil !== scope.tehsil) return;
          }
        }
        const ucName = data.uploadedBy?.split(' - ')?.[0] || '';
        queueNotification({
          id: docId,
          title: `New ${data.dogType || 'Dog'} Report`,
          message: `${ucName} reported in ${data.tahsil || 'Unknown'} tehsil`,
          timestamp: data.timestamp,
          data: {
            dogType: data.dogType,
            tahsil: data.tahsil,
            district: data.district,
            uploadedBy: data.uploadedBy,
            status: data.status
          },
          read: false
        });
      });
    });

    const debounceTimer = refs.current.debounceTimer;
    return () => {
      unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueNotification]);

  // Cleanup old processed IDs every 5 minutes
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (refs.current.processedIds.size > 100) {
        refs.current.processedIds.clear();
      }
    }, 300000);
    return () => clearInterval(cleanup);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAllAsRead,
      markAsRead,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export default NotificationContext;
