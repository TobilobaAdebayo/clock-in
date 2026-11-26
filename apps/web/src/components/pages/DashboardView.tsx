'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card } from '../ui';

interface DashboardData {
  workspace: {
    name: string;
    timezone: string;
  };
  metrics: {
    todayVisits: number;
    currentlyCheckedIn: number;
    thisWeekVisits: number;
    thisMonthVisits: number;
  };
  recentCheckIns: Array<{
    id: string;
    hostName?: string | null;
    checkIn: string;
    checkOut: string | null;
    visitor: {
      id: string;
      fullName: string;
      phoneNumber: string | null;
    };
  }>;
}

export function DashboardView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recent Check-Ins search & filter state
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_OUT'>('ALL');
  const [hostFilter, setHostFilter] = useState('');

  const todayFormatted = formatDayAndDate(new Date(), { longMonth: true });
  const activeFilterCount = (statusFilter !== 'ALL' ? 1 : 0) + (hostFilter.trim() ? 1 : 0);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<DashboardData>('/api/v1/dashboard/summary');
      setData(res.data!);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const filteredRecentCheckIns = useMemo(() => {
    const items = data?.recentCheckIns || [];
    const q = search.trim().toLowerCase();
    const hq = hostFilter.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter === 'ACTIVE' && item.checkOut !== null) return false;
      if (statusFilter === 'CHECKED_OUT' && item.checkOut === null) return false;
      if (hq && !(item.hostName || '').toLowerCase().includes(hq)) return false;
      if (q) {
        const matchesName = item.visitor.fullName.toLowerCase().includes(q);
        const matchesPhone = (item.visitor.phoneNumber || '').toLowerCase().includes(q);
        const matchesHost = (item.hostName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesHost) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, hostFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`DARE ADEBOYE INNOVATION HUB · ${basePath === '/super-admin' ? 'SUPER ADMIN' : 'RECEPTIONIST'}`}
        title="Dashboard"
        description={
          <>
            Welcome back, <span className="font-semibold text-[#1F2937]">{user?.fullName}</span>. Today is{' '}
            <span className="font-semibold text-[#34526E]">{todayFormatted}</span>.
          </>
        }
        actions={
          <Button variant="secondary" onClick={fetchSummary}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7A8C]">
            Today&apos;s Visits
          </div>
          <div className="text-3xl font-bold text-[#111827] mt-2">
            {loading ? '...' : data?.metrics.todayVisits ?? 0}
          </div>
        </Card>

        <div className="p-5 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34526E]">
              Currently in Hub
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-[#1E3A54] mt-2">
            {loading ? '...' : data?.metrics.currentlyCheckedIn ?? 0}
          </div>
          <Link
            href={`${basePath}/visitors?status=ACTIVE`}
            className="text-xs text-[#34526E] hover:underline mt-1.5 inline-block font-semibold"
          >
            View active visitors &rarr;
          </Link>
        </div>

        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7A8C]">
            This Week
          </div>
          <div className="text-3xl font-bold text-[#111827] mt-2">
            {loading ? '...' : data?.metrics.thisWeekVisits ?? 0}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7A8C]">
            This Month
          </div>
          <div className="text-3xl font-bold text-[#111827] mt-2">
            {loading ? '...' : data?.metrics.thisMonthVisits ?? 0}
          </div>
        </Card>
      </div>

      {/* Recent Check-Ins Table with Search & Far-Right Filter Icon */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6ECF2] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111827]">Recent Check-Ins</h2>
            <Link
              href={`${basePath}/attendance`}
              className="text-xs font-semibold text-[#34526E] hover:underline"
            >
              View all attendance &rarr;
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
              <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
              <input
                type="text"
                placeholder="Search recent check-ins by name, phone, or who they came to see..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[#6B7A8C] hover:text-[#111827]"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="Filter recent check-ins"
              title="Filter recent check-ins"
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border text-sm font-medium transition flex-shrink-0 ${showFilters || activeFilterCount > 0
                ? 'border-[#34526E] bg-[#EEF3F7] text-[#1E3A54]'
                : 'border-[#DCE3EB] bg-white text-[#475569] hover:bg-[#F7F9FB]'
                }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#34526E] text-white text-[11px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-[#E6ECF2] flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CHECKED_OUT')
                  }
                  className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active (In Hub)</option>
                  <option value="CHECKED_OUT">Checked Out</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                  Here To See
                </label>
                <input
                  type="text"
                  placeholder="Filter by host..."
                  value={hostFilter}
                  onChange={(e) => setHostFilter(e.target.value)}
                  className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                />
              </div>

              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setHostFilter('');
                  }}
                >
                  Reset filters
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Visitor</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Here To See</th>
                <th className="px-6 py-3.5">Day &amp; Date</th>
                <th className="px-6 py-3.5">Check-In Time</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading recent check-ins...
                  </td>
                </tr>
              ) : filteredRecentCheckIns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No matching check-ins found.
                  </td>
                </tr>
              ) : (
                filteredRecentCheckIns.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827]">
                      <Link
                        href={`${basePath}/visitors/${item.visitor.id}`}
                        className="hover:text-[#34526E]"
                      >
                        {item.visitor.fullName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#475569]">
                      {item.visitor.phoneNumber || '—'}
                    </td>
                    <td className="px-6 py-4 text-[#1F2937]">{item.hostName || '—'}</td>
                    <td className="px-6 py-4 font-medium text-[#1F2937]">
                      {formatDayAndDate(item.checkIn)}
                    </td>
                    <td className="px-6 py-4">{formatTime(item.checkIn)}</td>
                    <td className="px-6 py-4">
                      {item.checkOut ? (
                        <Badge tone="neutral">Checked Out</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
