"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FilterProvider } from "@/context/FilterContext";
import { NotificationProvider } from "@/context/NotificationContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProtectedRoute>
      <FilterProvider>
        <NotificationProvider>
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar
              open={mobileOpen}
              onClose={() => setMobileOpen(false)}
            />
            <div className="flex min-w-0 flex-1 flex-col md:pl-60">
              <Header onMenuClick={() => setMobileOpen(true)} />
              <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
                {children}
              </main>
            </div>
          </div>
        </NotificationProvider>
      </FilterProvider>
    </ProtectedRoute>
  );
}
