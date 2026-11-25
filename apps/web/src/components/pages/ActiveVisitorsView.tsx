'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Badge, Button, Card } from '../ui';

interface ActiveSession {
  id: string;
  checkIn: string;
  visitor: {
    id: string;
    fullName: string;
    phoneNumber: string;
  };
}

export function ActiveVisitorsView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const [activeList, setActiveList] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

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

      <Card className="overflow-hidden">
        <div className="px-6 py-3.5 border-b border-[#E6ECF2] bg-[#F9FBFC] flex items-center justify-between text-xs text-[#6B7A8C]">
          <span>
            Currently Signed In: <strong className="text-[#111827]">{activeList.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Visitor</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Check-In Day</th>
                <th className="px-6 py-3.5">Check-In Time</th>
                <th className="px-6 py-3.5 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading && activeList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading active visitors...
                  </td>
                </tr>
              ) : activeList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No visitors are currently signed in.
                  </td>
                </tr>
              ) : (
                activeList.map((item) => (
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
                    <td className="px-6 py-4">
                      <Badge tone="success">{formatTime(item.checkIn)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`${basePath}/visitors/${item.visitor.id}`}
                        className="text-xs font-semibold text-[#34526E] hover:underline"
                      >
                        View &rarr;
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
