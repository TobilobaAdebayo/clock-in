'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
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
    checkIn: string;
    checkOut: string | null;
    visitor: {
      id: string;
      fullName: string;
      phoneNumber: string;
    };
  }>;
}

export function DashboardView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayFormatted = formatDayAndDate(new Date(), { longMonth: true });

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
            href={`${basePath}/active`}
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

      {/* Recent Check-Ins Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6ECF2] flex items-center justify-between">
          <h2 className="text-base font-bold text-[#111827]">Recent Check-Ins</h2>
          <Link
            href={`${basePath}/attendance`}
            className="text-xs font-semibold text-[#34526E] hover:underline"
          >
            View all attendance &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Visitor</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Day &amp; Date</th>
                <th className="px-6 py-3.5">Check-In Time</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading recent check-ins...
                  </td>
                </tr>
              ) : data?.recentCheckIns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No visitor check-ins recorded today yet.
                  </td>
                </tr>
              ) : (
                data?.recentCheckIns.map((item) => (
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
                      {item.visitor.phoneNumber}
                    </td>
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
