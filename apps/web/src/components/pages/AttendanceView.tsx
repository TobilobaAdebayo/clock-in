'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Modal, Pagination } from '../ui';

interface AttendanceItem {
  id: string;
  checkIn: string;
  checkOut: string | null;
  visitor: {
    id: string;
    fullName: string;
    phoneNumber: string;
  };
}

export function AttendanceView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [correctingRecord, setCorrectingRecord] = useState<AttendanceItem | null>(null);
  const [checkInInput, setCheckInInput] = useState('');
  const [checkOutInput, setCheckOutInput] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canCorrect = user?.role === 'SUPER_ADMIN';

  const fetchAttendance = async (page = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(status !== 'ALL' ? { status } : {}),
        ...(search ? { search } : {}),
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
  }, [status, search]);

  const openCorrectionModal = (item: AttendanceItem) => {
    setCorrectingRecord(item);
    setCheckInInput(new Date(item.checkIn).toISOString().slice(0, 16));
    setCheckOutInput(item.checkOut ? new Date(item.checkOut).toISOString().slice(0, 16) : '');
    setLeaveOpen(!item.checkOut);
    setReason('');
    setCorrectError(null);
  };

  const handleCorrectSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!correctingRecord) return;
    setCorrectError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setCorrectError('Please enter a reason of at least 5 characters.');
      return;
    }

    try {
      setCorrecting(true);
      await apiClient(`/api/v1/attendance/${correctingRecord.id}/correct`, {
        method: 'PATCH',
        body: JSON.stringify({
          checkIn: new Date(checkInInput).toISOString(),
          checkOut: leaveOpen ? null : checkOutInput ? new Date(checkOutInput).toISOString() : null,
          reason: reason.trim(),
        }),
      });

      setSuccessMsg('Attendance record updated.');
      setCorrectingRecord(null);
      fetchAttendance(meta.page);
    } catch (err: any) {
      setCorrectError(err.message || 'Correction failed');
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Attendance Records"
        description="View and filter visitor check-in and check-out history."
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium border border-emerald-200">
          {successMsg}
        </div>
      )}

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search visitor name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
          />
        </div>
        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E] bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Currently In Hub</option>
            <option value="CHECKED_OUT">Checked Out</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Visitor</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Day &amp; Date</th>
                <th className="px-6 py-3.5">Time In</th>
                <th className="px-6 py-3.5">Time Out</th>
                <th className="px-6 py-3.5">Status</th>
                {canCorrect && <th className="px-6 py-3.5 text-right">Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={canCorrect ? 7 : 6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={canCorrect ? 7 : 6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827]">
                      <Link
                        href={`${basePath}/visitors/${item.visitor.id}`}
                        className="hover:text-[#34526E]"
                      >
                        {item.visitor.fullName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{item.visitor.phoneNumber}</td>
                    <td className="px-6 py-4 font-medium text-[#1F2937]">
                      {formatDayAndDate(item.checkIn)}
                    </td>
                    <td className="px-6 py-4">{formatTime(item.checkIn)}</td>
                    <td className="px-6 py-4">
                      {item.checkOut ? formatTime(item.checkOut) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {item.checkOut ? (
                        <Badge tone="neutral">Checked Out</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </td>
                    {canCorrect && (
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openCorrectionModal(item)}
                          className="text-xs font-semibold text-[#34526E] hover:underline"
                        >
                          Correct
                        </button>
                      </td>
                    )}
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

      <Modal
        open={Boolean(correctingRecord)}
        title={`Correct Attendance: ${correctingRecord?.visitor.fullName || ''}`}
        onClose={() => setCorrectingRecord(null)}
      >
        {correctError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
            {correctError}
          </div>
        )}

        <form onSubmit={handleCorrectSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#1F2937]">Check-In Time</label>
            <input
              type="datetime-local"
              required
              value={checkInInput}
              onChange={(e) => setCheckInInput(e.target.value)}
              className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-semibold text-[#1F2937]">Check-Out Time</label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#475569] cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaveOpen}
                  onChange={(e) => setLeaveOpen(e.target.checked)}
                  className="rounded text-[#34526E]"
                />
                Still active
              </label>
            </div>
            {!leaveOpen && (
              <input
                type="datetime-local"
                required={!leaveOpen}
                value={checkOutInput}
                onChange={(e) => setCheckOutInput(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#1F2937]">Reason</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for correction..."
              className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6ECF2]">
            <Button type="button" variant="secondary" onClick={() => setCorrectingRecord(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={correcting}>
              {correcting ? 'Saving...' : 'Save correction'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
