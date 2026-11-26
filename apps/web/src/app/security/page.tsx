'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, LogOut, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatTime } from '../../lib/format-date';
import { Badge, Button, Card, Input, Modal } from '../../components/ui';

interface ActiveVisitorSession {
  id: string;
  hostName?: string | null;
  checkIn: string;
  visitor: {
    id: string;
    fullName: string;
  };
}

export default function SecurityDeskPage() {
  const [activeSessions, setActiveSessions] = useState<ActiveVisitorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [signingOutId, setSigningOutId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sign In Visitor popup modal
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hostName, setHostName] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchActive = async () => {
    try {
      setLoading(true);
      const res = await apiClient<ActiveVisitorSession[]>('/api/v1/attendance/active');
      setActiveSessions(res.data || []);
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Failed to load active visitors.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSessions;
    return activeSessions.filter(
      (s) =>
        s.visitor.fullName.toLowerCase().includes(q) ||
        (s.hostName || '').toLowerCase().includes(q),
    );
  }, [activeSessions, search]);

  const openSignInModal = () => {
    setFullName('');
    setPhoneNumber('');
    setHostName('');
    setModalError(null);
    setShowSignInModal(true);
  };

  const handleSignInSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError(null);
    setBanner(null);

    try {
      setSaving(true);
      await apiClient('/api/v1/attendance/manual-check-in', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
          ...(hostName.trim() ? { hostName: hostName.trim() } : {}),
        }),
      });
      const visitorName = fullName.trim();
      setShowSignInModal(false);
      setBanner({ type: 'success', text: `${visitorName} has been clocked in.` });
      fetchActive();
    } catch (err: any) {
      setModalError(err.message || 'Could not clock in visitor.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async (session: ActiveVisitorSession) => {
    setBanner(null);
    setSigningOutId(session.id);

    try {
      await apiClient(`/api/v1/attendance/${session.id}/manual-check-out`, {
        method: 'POST',
      });
      setBanner({ type: 'success', text: `${session.visitor.fullName} has been clocked out.` });
      fetchActive();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Failed to clock out visitor.' });
    } finally {
      setSigningOutId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C]">
            FRONT DESK COVERAGE
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] mt-0.5">
            Visitor Clock In
          </h1>
          <p className="text-sm text-[#6B7A8C] mt-1">
            Clock visitors in when they arrive and clock them out when leaving.
          </p>
        </div>

        <Button
          type="button"
          onClick={openSignInModal}
          className="w-full sm:w-auto min-h-[48px] px-6 text-base"
        >
          <UserPlus className="w-5 h-5" />
          Clock In
        </Button>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium border flex items-center justify-between gap-3 ${banner.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
            }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Live Count */}
      <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-[#DCE3EB] rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#34526E]/20 focus-within:border-[#34526E]">
          <Search className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search visitors currently inside..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-base sm:text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
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

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF3F7] border border-[#DCE6EE] text-xs font-semibold text-[#1E3A54]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Currently Inside: {activeSessions.length}
          </div>
          <Button type="button" variant="secondary" onClick={fetchActive} className="min-h-[40px]">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </Card>

      {/* Live Currently Signed-In List (No phone numbers exposed) */}
      <Card className="overflow-hidden">
        {loading && activeSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6B7A8C]">Loading active visitors...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="text-sm font-medium text-[#475569]">
              {search ? 'No clocked-in visitor matches your search.' : 'No visitors are currently clocked in.'}
            </div>
            {!search && (
              <p className="text-xs text-[#6B7A8C]">
                Tap <strong>Clock In</strong> above when a guest arrives.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EEF2F6]">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FBFC] transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-[#111827] text-base">
                      {session.visitor.fullName}
                    </span>
                    <Badge tone="success">Inside</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7A8C]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#34526E]" />
                      Clocked in at {formatTime(session.checkIn)}
                    </span>
                    {session.hostName && (
                      <span>
                        Here to see: <strong className="text-[#1F2937]">{session.hostName}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  isLoading={signingOutId === session.id}
                  onClick={() => handleSignOut(session)}
                  className="w-full sm:w-auto min-h-[44px] border-amber-200 text-amber-800 hover:bg-amber-50"
                >
                  <LogOut className="w-4 h-4" />
                  {signingOutId === session.id ? 'Clocking out...' : 'Clock Out'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Clock In Visitor Popup Modal */}
      <Modal
        open={showSignInModal}
        title="Clock In Visitor"
        subtitle="Only Full Name is required. Works for both new and returning visitors."
        onClose={() => setShowSignInModal(false)}
      >
        {modalError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
            {modalError}
          </div>
        )}

        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            required
            autoFocus
            placeholder="e.g. Adebayo Ogunlesi"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="e.g. 0803 123 4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />

          <Input
            label="Who are you here to see? (Optional)"
            type="text"
            placeholder="e.g. Mr. Tunde or Operations Desk"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6ECF2]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSignInModal(false)}
              disabled={saving}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} className="min-h-[44px] px-6">
              {saving ? 'Clocking in...' : 'Clock In'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
