import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ADMIN_MANAGEMENT_EMAILS } from '../config/adminAccess';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin');
    if (storedAdmin) {
      try {
        const parsedAdmin = JSON.parse(storedAdmin);
        setAdmin(parsedAdmin);
      } catch (error) {
        localStorage.removeItem('admin');
      }
    }
    setLoading(false);
  }, []);

  // Login function
  const login = useCallback((adminData) => {
    const adminWithTime = {
      ...adminData,
      loginTime: new Date().toISOString()
    };
    setAdmin(adminWithTime);
    localStorage.setItem('admin', JSON.stringify(adminWithTime));
  }, []);

  // Logout function
  const logout = useCallback(() => {
    setAdmin(null);
    localStorage.removeItem('admin');
  }, []);

  // Listen for status changes in real-time
  useEffect(() => {
    if (!admin?.id) return;

    const adminRef = doc(db, 'Admins', admin.id);
    const unsubscribe = onSnapshot(adminRef, (docSnap) => {
      if (docSnap.exists()) {
        const adminData = docSnap.data();
        if (adminData.status === 'inactive') {
          console.warn('Admin account deactivated. Logging out...');
          logout();
        }
      } else {
        // Document deleted
        console.warn('Admin account deleted. Logging out...');
        logout();
      }
    }, (error) => {
      console.error('Error listening to admin status:', error);
    });

    return () => unsubscribe();
  }, [admin?.id, logout]);

  // Update admin data
  const updateAdmin = useCallback((updatedData) => {
    const updated = { ...admin, ...updatedData };
    setAdmin(updated);
    localStorage.setItem('admin', JSON.stringify(updated));
  }, [admin]);

  // Compute admin's geographic scope
  const adminScope = useMemo(() => {
    // Check if the current admin is in the authorized developer/super admin list
    const normalizedEmail = admin?.email?.toLowerCase()?.trim();
    const isFullAccess = ADMIN_MANAGEMENT_EMAILS.some(
      email => email.toLowerCase().trim() === normalizedEmail
    );

    if (isFullAccess) {
      return {
        accessLevel: 'province',
        province: admin?.province || 'Punjab',
        division: null,
        district: null,
        tehsil: null,
      };
    }

    return {
      accessLevel: admin?.accessLevel || 'division',
      province: admin?.province || 'Punjab',
      division: admin?.division || 'Multan',
      district: admin?.district || null,
      tehsil: admin?.tehsil || null,
    };
  }, [admin]);

  const value = {
    admin,
    adminScope,
    isAuthenticated: !!admin,
    loading,
    login,
    logout,
    updateAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
