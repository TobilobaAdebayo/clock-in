'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { Badge, Card } from '../ui';

interface ProfileData {
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

interface AttendanceRecord {
  id: string;
  hostName?: string | null;
  checkIn: string;
  checkOut: string | null;
}

export function VisitorDetailView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const params = useParams();
  const visitorId = params.id as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profileRes, historyRes] = await Promise.all([
          apiClient<ProfileData>(`/api/v1/visitors/${visitorId}`),
          apiClient<AttendanceRecord[]>(`/api/v1/visitors/${visitorId}/attendance?limit=20`),
        ]);

        setProfile(profileRes.data!);
        setHistory(historyRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (visitorId) loadData();
  }, [visitorId]);

  if (loading) {
    return <div className="p-8 text-center text-[#6B7A8C]">Loading visitor profile...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-red-600">Visitor profile not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-[#6B7A8C]">
        <Link href={`${basePath}/visitors`} className="hover:text-[#34526E] hover:underline">
          &larr; Visitor Directory
        </Link>
        <span>/</span>
        <span className="text-[#111827] font-semibold">{profile.visitor.fullName}</span>
      </div>

      <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[#111827]">{profile.visitor.fullName}</h1>
            {profile.stats.currentlyCheckedIn ? (
              <Badge tone="success">Currently Checked In</Badge>
            ) : (
              <Badge tone="neutral">Clocked Out</Badge>
            )}
          </div>
          <div className="text-sm font-mono text-[#475569] mt-1">
            {profile.visitor.phoneNumber || 'Phone not provided'}
          </div>
          <div className="text-xs text-[#6B7A8C] mt-1">
            Registered on {formatDayAndDate(profile.visitor.createdAt)}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7A8C]">
            Total Visits
          </div>
          <div className="text-2xl font-bold text-[#111827] mt-1.5">{profile.stats.totalVisits}</div>
        </Card>

        <div className="p-5 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34526E]">
            This Week&apos;s Visits
          </div>
          <div className="text-2xl font-bold text-[#1E3A54] mt-1.5">
            {profile.stats.thisWeekVisits}
          </div>
        </div>

        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7A8C]">
            This Month&apos;s Visits
          </div>
          <div className="text-2xl font-bold text-[#111827] mt-1.5">
            {profile.stats.thisMonthVisits}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6ECF2]">
          <h2 className="text-base font-bold text-[#111827]">Attendance History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Day &amp; Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Here To See</th>
                <th className="px-6 py-4 whitespace-nowrap">Time In</th>
                <th className="px-6 py-4 whitespace-nowrap">Time Out</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No attendance records for this visitor yet.
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827] whitespace-nowrap">
                      {formatDayAndDate(record.checkIn)}
                    </td>
                    <td className="px-6 py-4 text-[#1F2937] whitespace-nowrap">
                      {record.hostName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatTime(record.checkIn)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.checkOut ? formatTime(record.checkOut) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
      </Card>
    </div>
  );
}
