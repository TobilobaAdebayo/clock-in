'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Sidebar, Topbar } from '../../components/layout';
import { PortalLoginForm } from '../../components/auth/PortalLoginForm';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role !== 'SUPER_ADMIN') {
      router.push('/staff');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#34526E] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6B7A8C] font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  // Super Admin signs in directly at /super-admin
  if (!isAuthenticated || !user) {
    return (
      <PortalLoginForm
        title="Super Admin Portal"
        subtitle="Sign in with your Super Admin email and password for full workspace access."
        placeholderEmail="admin@clockin.workspace"
        redirectOnLogin={false}
      />
    );
  }

  if (user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#34526E] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6B7A8C] font-medium">Redirecting to Receptionist portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FB]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar sectionLabel="Dare Adeboye Innovation Hub · Super Admin" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full">{children}</main>
      </div>
    </div>
  );
}
