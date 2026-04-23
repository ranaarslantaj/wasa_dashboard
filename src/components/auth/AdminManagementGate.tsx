"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageLoader } from "@/components/ui/PageLoader";

export interface AdminManagementGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminManagementGate({
  children,
  fallback,
}: AdminManagementGateProps) {
  const router = useRouter();
  const toast = useToast();
  const { adminScope, loading, isAuthenticated } = useAuth();
  const redirectedRef = useRef(false);

  const hasFullAccess = adminScope?.fullAccess === true;

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/login");
      }
      return;
    }
    if (!hasFullAccess && !redirectedRef.current) {
      redirectedRef.current = true;
      toast.show({
        type: "error",
        title: "Access restricted",
      });
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, hasFullAccess, router, toast]);

  if (loading) {
    return <PageLoader label="Loading session..." />;
  }

  if (!hasFullAccess) {
    return <>{fallback ?? <PageLoader label="Redirecting..." />}</>;
  }

  return <>{children}</>;
}

export default AdminManagementGate;
