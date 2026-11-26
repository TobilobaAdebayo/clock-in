'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatDayAndDate, formatShortDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Modal, Pagination } from '../ui';

interface Visitor {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  createdAt: string;
  hasActiveSession?: boolean;
  activeSession?: {
    id: string;
    checkIn: string;
    hostName?: string | null;
  } | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface VisitorProfileDetail {
  visitor: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
    createdAt: string;
  };
  stats: {
    totalVisits: number;
    thisWeekVisits: number;
    thisMonthVisits: number;
    lastVisitDate: string | null;
    currentlyCheckedIn: boolean;
  };
}

interface AttendanceHistoryRow {
  id: string;
  hostName?: string | null;
  checkIn: string;
  checkOut: string | null;
}

function VisitorsDirectoryContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_OUT'>(
    initialStatus === 'ACTIVE' || initialStatus === 'CHECKED_OUT' ? initialStatus : 'ALL',
  );
  const [loading, setLoading] = useState(true);

  // Additional filter state
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-asc'>('newest');
  const [registeredDate, setRegisteredDate] = useState('');

  // Visitor Details Popup Modal state
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProfile, setModalProfile] = useState<VisitorProfileDetail | null>(null);
  const [modalHistory, setModalHistory] = useState<AttendanceHistoryRow[]>([]);

  const activeFilterCount =
    (sessionFilter !== 'ALL' ? 1 : 0) +
    (sortOrder !== 'newest' ? 1 : 0) +
    (registeredDate ? 1 : 0);

  useEffect(() => {
    if (initialStatus === 'ACTIVE' || initialStatus === 'CHECKED_OUT') {
      setSessionFilter(initialStatus);
    }
  }, [initialStatus]);

  const fetchVisitors = async (
    page = 1,
    searchQuery = '',
    statusFilter: 'ALL' | 'ACTIVE' | 'CHECKED_OUT' = sessionFilter,
  ) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      });

      const res = await apiClient<Visitor[]>(`/api/v1/visitors?${queryParams.toString()}`);
      setVisitors(res.data || []);
      if ((res as any).meta) setMeta((res as any).meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchVisitors(1, search, sessionFilter);
    }, 300);
    return () => clearTimeout(handler);
  }, [search, sessionFilter]);

  const displayedVisitors = useMemo(() => {
    let list = [...visitors];
    if (registeredDate) {
      list = list.filter((v) => v.createdAt.slice(0, 10) === registeredDate);
    }
    if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === 'name-asc') {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return list;
  }, [visitors, sortOrder, registeredDate]);

  const openVisitorPopup = async (visitorId: string) => {
    setSelectedVisitorId(visitorId);
    setModalProfile(null);
    setModalHistory([]);
    setModalLoading(true);

    try {
      const [profileRes, historyRes] = await Promise.all([
        apiClient<VisitorProfileDetail>(`/api/v1/visitors/${visitorId}`),
        apiClient<AttendanceHistoryRow[]>(`/api/v1/visitors/${visitorId}/attendance?limit=10`),
      ]);
      setModalProfile(profileRes.data || null);
      setModalHistory(historyRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeVisitorPopup = () => {
    setSelectedVisitorId(null);
    setModalProfile(null);
    setModalHistory([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Visitor Directory"
        description="Search registered visitors and view who currently has an active session."
      />

      {/* Search Bar + Active Session Filter + Far-Right Filter Icon */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
            <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by visitor name or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-medium text-[#6B7A8C] hover:text-[#111827]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={sessionFilter}
              onChange={(e) =>
                setSessionFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CHECKED_OUT')
              }
              aria-label="Filter visitors by session status"
              className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[40px] border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
            >
              <option value="ALL">All Visitors</option>
              <option value="ACTIVE">Active Session</option>
              <option value="CHECKED_OUT">Clocked Out</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="Toggle filters"
              title="Filter visitors"
              className={`relative inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border text-sm font-medium transition flex-shrink-0 ${
                showFilters || activeFilterCount > 0
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
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-[#E6ECF2] flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                Session Status
              </label>
              <select
                value={sessionFilter}
                onChange={(e) =>
                  setSessionFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CHECKED_OUT')
                }
                className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              >
                <option value="ALL">All Visitors</option>
                <option value="ACTIVE">Active Session</option>
                <option value="CHECKED_OUT">Clocked Out</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                Sort By
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'name-asc')}
                className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              >
                <option value="newest">Newest Registered</option>
                <option value="oldest">Oldest Registered</option>
                <option value="name-asc">Name (A–Z)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                Registered Date
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="px-3 py-1.5 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              />
            </div>

            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSessionFilter('ALL');
                  setSortOrder('newest');
                  setRegisteredDate('');
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Visitor Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Phone Number</th>
                <th className="px-6 py-4 whitespace-nowrap">Session Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Registered On</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading visitors...
                  </td>
                </tr>
              ) : displayedVisitors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No visitors found.
                  </td>
                </tr>
              ) : (
                displayedVisitors.map((visitor) => (
                  <tr key={visitor.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openVisitorPopup(visitor.id)}
                        className="hover:text-[#34526E] text-left"
                      >
                        {visitor.fullName}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                      {visitor.phoneNumber || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {visitor.hasActiveSession ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge tone="success">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                            Active Session
                          </Badge>
                          {visitor.activeSession?.checkIn && (
                            <span className="text-[11px] text-[#6B7A8C]">
                              In at {formatTime(visitor.activeSession.checkIn)}
                              {visitor.activeSession.hostName
                                ? ` · ${visitor.activeSession.hostName}`
                                : ''}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge tone="neutral">Clocked Out</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6B7A8C] whitespace-nowrap">
                      {formatShortDayAndDate(visitor.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openVisitorPopup(visitor.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          label="visitors"
          onPageChange={(nextPage) => fetchVisitors(nextPage, search, sessionFilter)}
        />
      </Card>

      {/* Visitor Information Popup Modal (stays on Visitor Directory) */}
      <Modal
        open={Boolean(selectedVisitorId)}
        title={modalProfile?.visitor.fullName || 'Visitor Information'}
        subtitle={
          modalProfile
            ? `Registered on ${formatDayAndDate(modalProfile.visitor.createdAt)}`
            : undefined
        }
        size="xl"
        onClose={closeVisitorPopup}
      >
        {modalLoading ? (
          <div className="py-10 text-center text-sm text-[#6B7A8C]">
            Loading visitor details...
          </div>
        ) : !modalProfile ? (
          <div className="py-8 text-center text-sm text-red-600">
            Could not load visitor information.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#F9FBFC] border border-[#E6ECF2] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[#6B7A8C]">Phone Number</div>
                <div className="font-mono text-sm font-semibold text-[#111827] mt-0.5">
                  {modalProfile.visitor.phoneNumber || 'Not provided'}
                </div>
              </div>
              <div>
                {modalProfile.stats.currentlyCheckedIn ? (
                  <Badge tone="success">Active Session</Badge>
                ) : (
                  <Badge tone="neutral">Clocked Out</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-[#E6ECF2] bg-white">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                  Total Visits
                </div>
                <div className="text-xl font-bold text-[#111827] mt-1">
                  {modalProfile.stats.totalVisits}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#EEF3F7] border border-[#DCE6EE]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#34526E]">
                  This Week
                </div>
                <div className="text-xl font-bold text-[#1E3A54] mt-1">
                  {modalProfile.stats.thisWeekVisits}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[#E6ECF2] bg-white">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                  This Month
                </div>
                <div className="text-xl font-bold text-[#111827] mt-1">
                  {modalProfile.stats.thisMonthVisits}
                </div>
              </div>
            </div>

            <div className="border border-[#E6ECF2] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F9FBFC] border-b border-[#E6ECF2] text-xs font-semibold text-[#111827]">
                Recent Attendance History
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#475569]">
                  <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[10px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 whitespace-nowrap">Day &amp; Date</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Here To See</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Time In</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Time Out</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {modalHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-5 text-center text-[#6B7A8C]">
                          No attendance records yet.
                        </td>
                      </tr>
                    ) : (
                      modalHistory.map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-2.5 font-medium text-[#111827] whitespace-nowrap">
                            {formatDayAndDate(record.checkIn)}
                          </td>
                          <td className="px-4 py-2.5 text-[#1F2937] whitespace-nowrap">
                            {record.hostName || '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {formatTime(record.checkIn)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {record.checkOut ? formatTime(record.checkOut) : '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {record.checkOut ? (
                              <Badge tone="neutral">Clocked Out</Badge>
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
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-[#E6ECF2]">
          <Button type="button" variant="secondary" onClick={closeVisitorPopup}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function VisitorsView({ basePath: _basePath }: { basePath: '/staff' | '/super-admin' }) {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-sm text-[#6B7A8C]">Loading visitors...</div>}
    >
      <VisitorsDirectoryContent />
    </Suspense>
  );
}
