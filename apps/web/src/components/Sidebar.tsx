'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const basePath = isSuperAdmin ? '/super-admin' : '/staff';

  const navItems = [
    { label: 'Dashboard', href: basePath, exact: true },
    { label: 'Visitors', href: `${basePath}/visitors`, exact: false },
    { label: 'Attendance', href: `${basePath}/attendance`, exact: false },
    { label: 'Reports', href: `${basePath}/reports`, exact: false },
  ];

  const adminItems = [
    { label: 'Staff Accounts', href: '/super-admin/accounts', exact: false },
    { label: 'System Settings', href: '/super-admin/settings', exact: false },
    { label: 'Audit Logs', href: '/super-admin/audit-logs', exact: false },
  ];

  const renderBrand = () => (
    <Link href={basePath} className="flex items-center gap-3 px-2 mb-7">
      <div className="w-9 h-9 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        D
      </div>
      <div className="min-w-0">
        <div className="font-bold text-[#111827] text-xs leading-snug">{HUB_NAME}</div>
        <div className="text-[11px] text-[#6B7A8C]">Clock In</div>
      </div>
    </Link>
  );

  const renderNavItem = (
    item: { label: string; href: string; exact: boolean },
    onNavigate?: () => void,
  ) => {
    const active = item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition ${active
            ? 'bg-[#EEF3F7] text-[#1E3A54] font-semibold'
            : 'text-[#6B7A8C] hover:bg-[#F3F6F9] hover:text-[#1F2937] font-medium'
          }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-[#34526E]' : 'bg-[#CBD5E1]'
            }`}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const renderLinks = (onNavigate?: () => void) => (
    <nav className="space-y-1">
      <div className="text-[10.5px] font-semibold text-[#94A3B8] uppercase tracking-[0.08em] px-3 mb-2">
        {isSuperAdmin ? 'Workspace' : 'Receptionist'}
      </div>
      {navItems.map((item) => renderNavItem(item, onNavigate))}

      {isSuperAdmin && (
        <div className="pt-6 space-y-1">
          <div className="text-[10.5px] font-semibold text-[#94A3B8] uppercase tracking-[0.08em] px-3 mb-2">
            Super Admin
          </div>
          {adminItems.map((item) => renderNavItem(item, onNavigate))}
        </div>
      )}
    </nav>
  );

  const renderUserFooter = () => (
    <div className="border-t border-[#E6ECF2] pt-4 mt-4">
      <div className="px-2 py-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[#111827] text-[13px] truncate">{user.fullName}</div>
          <div className="text-[11px] text-[#6B7A8C] flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isSuperAdmin ? 'bg-[#34526E]' : 'bg-emerald-500'
                }`}
            />
            <span className="capitalize">{user.role.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isSuperAdmin && (
            <Link
              href="/staff/security"
              title="2FA Settings (Optional)"
              aria-label="2FA Settings"
              className="text-[#6B7A8C] hover:text-[#34526E] p-2 rounded-lg hover:bg-[#EEF3F7] transition"
            >
              <ShieldCheck className="w-4 h-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              logout(
                pathname.startsWith('/super-admin')
                  ? '/super-admin'
                  : pathname.startsWith('/staff')
                  ? '/staff'
                  : '/staff-login',
              )
            }
            title="Sign out"
            aria-label="Sign out"
            className="text-[#6B7A8C] hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-[#E6ECF2] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            D
          </div>
          <span className="font-bold text-[#111827] text-xs truncate">{HUB_NAME}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-[#475569] hover:bg-[#EEF3F7]"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-[#111827]/35"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[82vw] bg-white h-full p-4 flex flex-col justify-between shadow-xl z-50 overflow-y-auto border-r border-[#E6ECF2]">
            <div>
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    D
                  </div>
                  <span className="font-bold text-[#111827] text-xs truncate">{HUB_NAME}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-[#6B7A8C] hover:bg-[#EEF3F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderLinks(() => setMobileOpen(false))}
            </div>
            {renderUserFooter()}
          </aside>
        </div>
      )}

      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-[#E6ECF2] flex-col justify-between p-4 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div>
          {renderBrand()}
          {renderLinks()}
        </div>
        {renderUserFooter()}
      </aside>
    </>
  );
}
