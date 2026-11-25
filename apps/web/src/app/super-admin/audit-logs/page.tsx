'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { PageHeader } from '../../../components/layout';
import { Badge, Card } from '../../../components/ui';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
          />
        </div>
        <div>
          <select
            value={recordTypeFilter}
            onChange={(e) => setRecordTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E] bg-white"
          >
            <option value="">All Record Types</option>
            <option value="STAFF">Staff</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="SETTING">Settings</option>
          </select>
        </div>
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
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
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
