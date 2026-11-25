'use client';

import React from 'react';
import { useAuth } from '../../lib/auth-context';
import { Sidebar, Topbar } from '../../components/layout';
import { PortalLoginForm } from '../../components/auth/PortalLoginForm';

export default function StaffPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

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

  // Receptionist (or Super Admin) signs in directly at /staff
  if (!isAuthenticated || !user) {
    return (
      <PortalLoginForm
        title="Receptionist Portal"
        subtitle="Sign in with your email and password to access the staff portal."
        placeholderEmail="receptionist@clockin.workspace"
        redirectOnLogin={false}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FB]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          sectionLabel={
            user.role === 'SUPER_ADMIN'
              ? 'Dare Adeboye Innovation Hub · Super Admin'
              : 'Dare Adeboye Innovation Hub · Receptionist'
          }
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full">{children}</main>
      </div>
    </div>
  );
}
