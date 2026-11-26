'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { formatDayAndDate } from '../../lib/format-date';
import { PortalLoginForm } from '../../components/auth/PortalLoginForm';
import { TwoFactorCard } from '../../components/pages/SecurityView';
import { Modal } from '../../components/ui';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export default function SecurityPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [show2faModal, setShow2faModal] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role === 'RECEPTIONIST') {
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

  if (!isAuthenticated || !user) {
    return (
      <PortalLoginForm
        title="Security Desk"
        subtitle="Sign in with your security email and password."
        placeholderEmail="security@clockin.workspace"
        redirectOnLogin={false}
      />
    );
  }

  if (user.role === 'RECEPTIONIST') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#34526E] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6B7A8C] font-medium">Redirecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <header className="bg-white border-b border-[#E6ECF2] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              D
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#111827] text-xs sm:text-sm truncate">{HUB_NAME}</div>
              <div className="text-[11px] text-[#6B7A8C] flex items-center gap-2">
                <span>Security Desk</span>
                <span className="hidden sm:inline">&middot;</span>
                <span className="hidden sm:inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#34526E]" />
                  {formatDayAndDate(new Date())}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden md:inline text-xs font-medium text-[#475569] mr-1">
              {user.fullName}
            </span>
            <button
              type="button"
              onClick={() => setShow2faModal(true)}
              title="2FA Settings (Optional)"
              aria-label="2FA Settings"
              className="p-2 rounded-lg text-[#6B7A8C] hover:text-[#34526E] hover:bg-[#EEF3F7] transition"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => logout('/security')}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#6B7A8C] hover:text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>

      <Modal
        open={show2faModal}
        title="Security (2FA)"
        subtitle="Optional Google Authenticator verification for your account."
        size="lg"
        onClose={() => setShow2faModal(false)}
      >
        <TwoFactorCard />
      </Modal>
    </div>
  );
}
