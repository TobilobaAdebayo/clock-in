'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card } from '../ui';

interface ActiveSession {
  id: string;
  hostName?: string | null;
  checkIn: string;
  visitor: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
  };
}

export function ActiveVisitorsView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const [activeList, setActiveList] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dayFilter, setDayFilter] = useState<'ALL' | 'TODAY' | 'EARLIER'>('ALL');
  const [hostFilter, setHostFilter] = useState('');

  const activeFilterCount = (dayFilter !== 'ALL' ? 1 : 0) + (hostFilter.trim() ? 1 : 0);

  const fetchActive = async () => {
    try {
      setLoading(true);
      const res = await apiClient<ActiveSession[]>('/api/v1/attendance/active');
      setActiveList(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredActive = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hq = hostFilter.trim().toLowerCase();
    const todayKey = new Date().toDateString();

    return activeList.filter((item) => {
      const isToday = new Date(item.checkIn).toDateString() === todayKey;
      if (dayFilter === 'TODAY' && !isToday) return false;
      if (dayFilter === 'EARLIER' && isToday) return false;
      if (hq && !(item.hostName || '').toLowerCase().includes(hq)) return false;
      if (q) {
        const matchesName = item.visitor.fullName.toLowerCase().includes(q);
        const matchesPhone = (item.visitor.phoneNumber || '').toLowerCase().includes(q);
        const matchesHost = (item.hostName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesHost) return false;
      }
      return true;
    });
  }, [activeList, search, dayFilter, hostFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Active Visitors"
        description="Visitors currently signed in."
        actions={
          <Button variant="secondary" onClick={fetchActive}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Search & Far-Right Filter Icon */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
            <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search active visitors by name, phone, or who they came to see..."
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
            aria-label="Filter active visitors"
            title="Filter active visitors"
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
                Check-In Day
              </label>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value as 'ALL' | 'TODAY' | 'EARLIER')}
                className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              >
                <option value="ALL">All Active</option>
                <option value="TODAY">Checked In Today</option>
                <option value="EARLIER">Earlier Days</option>
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
                  setDayFilter('ALL');
                  setHostFilter('');
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-3.5 border-b border-[#E6ECF2] bg-[#F9FBFC] flex items-center justify-between text-xs text-[#6B7A8C]">
          <span>
            Currently Signed In: <strong className="text-[#111827]">{filteredActive.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Visitor</th>
                <th className="px-6 py-4 whitespace-nowrap">Phone Number</th>
                <th className="px-6 py-4 whitespace-nowrap">Here To See</th>
                <th className="px-6 py-4 whitespace-nowrap">Clock-In Day</th>
                <th className="px-6 py-4 whitespace-nowrap">Clock-In Time</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading && activeList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading active visitors...
                  </td>
                </tr>
              ) : filteredActive.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No active visitors match your filter.
                  </td>
                </tr>
              ) : (
                filteredActive.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827] whitespace-nowrap">
                      <Link
                        href={`${basePath}/visitors/${item.visitor.id}`}
                        className="hover:text-[#34526E]"
                      >
                        {item.visitor.fullName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                      {item.visitor.phoneNumber || '—'}
                    </td>
                    <td className="px-6 py-4 text-[#1F2937] whitespace-nowrap">
                      {item.hostName || '—'}
                    </td>
                    <td className="px-6 py-4 font-medium text-[#1F2937] whitespace-nowrap">
                      {formatDayAndDate(item.checkIn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone="success">{formatTime(item.checkIn)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`${basePath}/visitors/${item.visitor.id}`}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-white border border-[#DCE3EB] hover:bg-[#F7F9FB] text-[#374151] transition"
                      >
                        View
                      </Link>
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
