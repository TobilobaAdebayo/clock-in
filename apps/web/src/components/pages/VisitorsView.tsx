'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatShortDayAndDate } from '../../lib/format-date';
import { PageHeader } from '../layout';
import { Card, Pagination } from '../ui';

interface Visitor {
  id: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function VisitorsView({ basePath }: { basePath: '/staff' | '/super-admin' }) {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVisitors = async (page = 1, searchQuery = '') => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(searchQuery ? { search: searchQuery } : {}),
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
      fetchVisitors(1, search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Visitor Directory"
        description="Search registered visitors by name or phone number."
      />

      <Card className="p-4 flex items-center gap-3">
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
          >
            Clear
          </button>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Visitor Name</th>
                <th className="px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">Registered On</th>
                <th className="px-6 py-3.5 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading visitors...
                  </td>
                </tr>
              ) : visitors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No visitors found.
                  </td>
                </tr>
              ) : (
                visitors.map((visitor) => (
                  <tr key={visitor.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827]">
                      <Link
                        href={`${basePath}/visitors/${visitor.id}`}
                        className="hover:text-[#34526E]"
                      >
                        {visitor.fullName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{visitor.phoneNumber}</td>
                    <td className="px-6 py-4 text-xs text-[#6B7A8C]">
                      {formatShortDayAndDate(visitor.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`${basePath}/visitors/${visitor.id}`}
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

        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          label="visitors"
          onPageChange={(nextPage) => fetchVisitors(nextPage, search)}
        />
      </Card>
    </div>
  );
}
