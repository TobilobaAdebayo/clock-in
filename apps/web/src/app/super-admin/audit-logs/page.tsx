'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { PageHeader } from '../../../components/layout';
import { Badge, Button, Card } from '../../../components/ui';

interface AuditLogItem {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  oldValues: any;
  newValues: any;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export default function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeFilterCount = (recordTypeFilter ? 1 : 0) + (actorFilter.trim() ? 1 : 0);

  const filteredLogs = useMemo(() => {
    const aq = actorFilter.trim().toLowerCase();
    if (!aq) return logs;
    return logs.filter(
      (log) =>
        (log.actor?.fullName || '').toLowerCase().includes(aq) ||
        (log.actor?.email || '').toLowerCase().includes(aq),
    );
  }, [logs, actorFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '25',
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(recordTypeFilter ? { recordType: recordTypeFilter } : {}),
      });

      const res = await apiClient<AuditLogItem[]>(`/api/v1/audit-logs?${params.toString()}`);
      setLogs(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, recordTypeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB · SUPER ADMIN"
        title="Audit Logs"
        description="History of staff updates, attendance corrections, and setting changes."
      />

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
            <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
            />
            {actionFilter && (
              <button
                type="button"
                onClick={() => setActionFilter('')}
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
            aria-label="Filter audit logs"
            title="Filter audit logs"
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border text-sm font-medium transition flex-shrink-0 ${
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

        {showFilters && (
          <div className="pt-3 border-t border-[#E6ECF2] flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                Record Type
              </label>
              <select
                value={recordTypeFilter}
                onChange={(e) => setRecordTypeFilter(e.target.value)}
                className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              >
                <option value="">All Record Types</option>
                <option value="STAFF">Staff</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="SETTING">Settings</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8C]">
                Actor
              </label>
              <input
                type="text"
                placeholder="Filter by staff name or email..."
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="px-3 py-2 border border-[#DCE3EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              />
            </div>

            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRecordTypeFilter('');
                  setActorFilter('');
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
                <th className="px-6 py-3.5">Date &amp; Time</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5 text-right">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-[#F9FBFC] transition">
                        <td className="px-6 py-4 text-xs font-mono text-[#6B7A8C] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#111827]">
                            {log.actor?.fullName || 'System'}
                          </div>
                          <div className="text-xs text-[#6B7A8C]">{log.actor?.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge tone="neutral">{log.action}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge tone="info">{log.recordType}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="text-xs font-semibold text-[#34526E] hover:underline"
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#F7F9FB]">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="p-3.5 bg-white rounded-xl border border-[#E6ECF2]">
                                <div className="font-bold text-red-600 mb-1">Previous</div>
                                <pre className="overflow-x-auto text-[#475569] whitespace-pre-wrap">
                                  {log.oldValues ? JSON.stringify(log.oldValues, null, 2) : 'None'}
                                </pre>
                              </div>
                              <div className="p-3.5 bg-white rounded-xl border border-[#E6ECF2]">
                                <div className="font-bold text-emerald-700 mb-1">Updated</div>
                                <pre className="overflow-x-auto text-[#475569] whitespace-pre-wrap">
                                  {log.newValues ? JSON.stringify(log.newValues, null, 2) : 'None'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
