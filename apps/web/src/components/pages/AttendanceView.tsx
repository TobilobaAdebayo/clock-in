'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Search, SlidersHorizontal, UserPlus, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Input, Modal, Pagination } from '../ui';

interface AttendanceItem {
  id: string;
  hostName?: string | null;
  checkIn: string;
  checkOut: string | null;
  visitor: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
  };
}

export function AttendanceView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const activeFilterCount = (startDate ? 1 : 0) + (endDate ? 1 : 0);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);

  // Staff Manual Clock-In Popup Modal state (Receptionist & Super Admin)
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualFullName, setManualFullName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualHostName, setManualHostName] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const showManualCheckIn =
    user?.role === 'RECEPTIONIST' || user?.role === 'SUPER_ADMIN';

  const fetchAttendance = async (page = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(status !== 'ALL' ? { status } : {}),
        ...(search ? { search } : {}),
        ...(startDate ? { startDate: new Date(`${startDate}T00:00:00`).toISOString() } : {}),
        ...(endDate ? { endDate: new Date(`${endDate}T23:59:59`).toISOString() } : {}),
      });

      const res = await apiClient<AttendanceItem[]>(`/api/v1/attendance?${queryParams.toString()}`);
      setRecords(res.data || []);
      if ((res as any).meta) setMeta((res as any).meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(1);
  }, [status, search, startDate, endDate]);

  const openManualCheckInModal = () => {
    setManualFullName('');
    setManualPhone('');
    setManualHostName('');
    setManualError(null);
    setShowManualModal(true);
  };

  const handleManualCheckInSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setManualError(null);
    setActionError(null);
    setSuccessMsg(null);

    try {
      setManualSaving(true);
      await apiClient('/api/v1/attendance/manual-check-in', {
        method: 'POST',
        body: JSON.stringify({
          fullName: manualFullName.trim(),
          ...(manualPhone.trim() ? { phoneNumber: manualPhone.trim() } : {}),
          hostName: manualHostName.trim(),
        }),
      });
      setShowManualModal(false);
      setSuccessMsg(`${manualFullName.trim()} has been clocked in.`);
      fetchAttendance(1);
    } catch (err: any) {
      setManualError(err.message || 'Failed to clock in visitor.');
    } finally {
      setManualSaving(false);
    }
  };

  const handleManualClockOut = async (item: AttendanceItem) => {
    setActionError(null);
    setSuccessMsg(null);
    setClockingOutId(item.id);

    try {
      await apiClient(`/api/v1/attendance/${item.id}/manual-check-out`, {
        method: 'POST',
      });
      setSuccessMsg(`${item.visitor.fullName} has been clocked out.`);
      fetchAttendance(meta.page);
    } catch (err: any) {
      setActionError(err.message || 'Failed to clock out visitor.');
    } finally {
      setClockingOutId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Attendance Records"
        description="View and filter visitor clock-in and clock-out history."
        actions={
          showManualCheckIn ? (
            <Button type="button" onClick={openManualCheckInModal}>
              <UserPlus className="w-4 h-4" />
              Manual Clock In
            </Button>
          ) : undefined
        }
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium border border-emerald-200">
          {successMsg}
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
          {actionError}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
            <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search visitor name, phone, or who they came to see..."
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

          <div className="flex items-center gap-2.5">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[40px] border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E] bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Currently In Hub</option>
              <option value="CHECKED_OUT">Clocked Out</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="Toggle date filters"
              title="Filter attendance records"
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border text-sm font-medium whitespace-nowrap transition flex-shrink-0 ${
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
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              />
            </div>

            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Reset dates
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
                <th className="px-6 py-4 whitespace-nowrap">Visitor</th>
                <th className="px-6 py-4 whitespace-nowrap">Phone Number</th>
                <th className="px-6 py-4 whitespace-nowrap">Here To See</th>
                <th className="px-6 py-4 whitespace-nowrap">Day &amp; Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Time In</th>
                <th className="px-6 py-4 whitespace-nowrap">Time Out</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
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
                    <td className="px-6 py-4 whitespace-nowrap">{formatTime(item.checkIn)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.checkOut ? formatTime(item.checkOut) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.checkOut ? (
                        <Badge tone="neutral">Clocked Out</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {!item.checkOut && showManualCheckIn ? (
                        <Button
                          type="button"
                          variant="warning"
                          size="sm"
                          isLoading={clockingOutId === item.id}
                          onClick={() => handleManualClockOut(item)}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          {clockingOutId === item.id ? 'Clocking Out...' : 'Clock Out'}
                        </Button>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
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
          label="records"
          onPageChange={(nextPage) => fetchAttendance(nextPage)}
        />
      </Card>

      {/* Staff Manual Clock-In Popup Modal (Receptionist & Super Admin) */}
      <Modal
        open={showManualModal}
        title="Manual Clock In"
        subtitle="Full Name and who they are here to see are required. Phone number is optional and works for both new and returning visitors."
        onClose={() => setShowManualModal(false)}
      >
        {manualError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
            {manualError}
          </div>
        )}

        <form onSubmit={handleManualCheckInSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            required
            autoFocus
            placeholder="e.g. Adebayo Ogunlesi"
            value={manualFullName}
            onChange={(e) => setManualFullName(e.target.value)}
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="e.g. 0803 123 4567"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
          />

          <Input
            label="Who are you here to see?"
            type="text"
            required
            placeholder="e.g. Mr. Tunde or Operations Desk"
            value={manualHostName}
            onChange={(e) => setManualHostName(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6ECF2]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowManualModal(false)}
              disabled={manualSaving}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={manualSaving}>
              {manualSaving ? 'Clocking In...' : 'Clock In'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
