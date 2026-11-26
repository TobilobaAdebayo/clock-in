'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Calendar, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../../lib/format-date';
import { Button, Input } from '../../../components/ui';

type Mode =
  | 'new'
  | 'returning-lookup'
  | 'returning-confirm'
  | 'returning-action'
  | 'returning-checkout'
  | 'success';

interface LookupData {
  lookupToken: string;
  checkOutToken?: string | null;
  matchedBy?: 'phone' | 'name';
  maskedName: string;
  maskedPhone: string;
  hasActiveSession: boolean;
  activeSession?: { id: string; checkIn: string } | null;
}

interface ActionData {
  actionToken: string;
  visitorId: string;
  fullName: string;
  hasActiveSession: boolean;
}

const HUB_NAME = 'Dare Adeboye Innovation Hub';

function CheckInFlow() {
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get('mode');
  const [mode, setMode] = useState<Mode>(
    initialModeParam === 'returning' ? 'returning-lookup' : 'new',
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Visitor Form State
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newHostName, setNewHostName] = useState('');

  // Returning Visitor State
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupData | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [returningHostName, setReturningHostName] = useState('');
  const [confirmedAction, setConfirmedAction] = useState<ActionData | null>(null);

  // Done / Full-Screen Welcome State
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    reminder: string;
    dayLabel: string;
    timestamp: string;
    status: 'CHECKED_IN' | 'CHECKED_OUT';
  } | null>(null);

  const [countdown, setCountdown] = useState(12);

  useEffect(() => {
    if (initialModeParam === 'returning') {
      setMode('returning-lookup');
    } else if (initialModeParam === 'new') {
      setMode('new');
    }
  }, [initialModeParam]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === 'success') {
      setCountdown(12);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            resetFlow();
            return 12;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode]);

  const resetFlow = () => {
    setMode(initialModeParam === 'returning' ? 'returning-lookup' : 'new');
    setFullName('');
    setPhoneNumber('');
    setNewHostName('');
    setLookupPhone('');
    setLookupResult(null);
    setConfirmationName('');
    setReturningHostName('');
    setConfirmedAction(null);
    setSuccessInfo(null);
    setErrorMessage(null);
  };

  // 1. Register new visitor & clock in (with who they are here to see)
  const handleRegister = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<any>('/api/v1/public/visitors/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
          hostName: newHostName.trim(),
        }),
      });

      const now = new Date(res.data?.attendance?.checkIn || Date.now());

      setSuccessInfo({
        title: `Done! Welcome to ${HUB_NAME}`,
        reminder:
          'Please make sure you always clock in whenever you arrive and remember that you must sign out / clock out before leaving.',
        dayLabel: formatDayAndDate(now, { longMonth: true }),
        timestamp: formatTime(now),
        status: 'CHECKED_IN',
      });
      setMode('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Returning visitor phone lookup
  //    - Already signed in -> skip name verification, go directly to phone-only sign-out
  //    - Not signed in -> verify name & who they are here to see before signing in
  const handleLookup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<LookupData>('/api/v1/public/visitors/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: lookupPhone.trim() }),
      });

      const data = res.data!;
      setLookupResult(data);

      if (data.hasActiveSession && data.checkOutToken) {
        setMode('returning-checkout');
      } else {
        setMode('returning-confirm');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Visitor not found.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Returning visitor name confirmation & who they are here to see (only when signing in)
  const handleConfirmIdentity = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<ActionData>('/api/v1/public/visitors/confirm', {
        method: 'POST',
        body: JSON.stringify({
          lookupToken: lookupResult!.lookupToken,
          confirmationAnswer: confirmationName,
        }),
      });

      setConfirmedAction(res.data!);
      setMode('returning-action');
    } catch (err: any) {
      setErrorMessage(err.message || 'Confirmation failed.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Returning visitor Clock In (with who they are here to see stored for this visit)
  const handleClockIn = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<any>('/api/v1/public/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          actionToken: confirmedAction!.actionToken,
          hostName: returningHostName.trim(),
        }),
      });

      const now = new Date(res.data?.checkIn || Date.now());

      setSuccessInfo({
        title: `Done! Welcome once again to ${HUB_NAME}`,
        reminder:
          'Please make sure you always clock in whenever you arrive, and remember that you must sign out / clock out before leaving.',
        dayLabel: formatDayAndDate(now, { longMonth: true }),
        timestamp: formatTime(now),
        status: 'CHECKED_IN',
      });
      setMode('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to clock in.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Returning visitor Clock Out (phone-only via checkOutToken, no name step needed)
  const handleDirectClockOut = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const token = lookupResult?.checkOutToken || confirmedAction?.actionToken;
      const res = await apiClient<any>('/api/v1/public/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ actionToken: token }),
      });

      const now = new Date(res.data?.checkOut || Date.now());

      setSuccessInfo({
        title: `Done! You have signed out of ${HUB_NAME}`,
        reminder: 'Thank you for visiting today. Please make sure you clock in on your next visit.',
        dayLabel: formatDayAndDate(now, { longMonth: true }),
        timestamp: formatTime(now),
        status: 'CHECKED_OUT',
      });
      setMode('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to clock out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col">
      {/* Compact Top Bar (no left sidebar, lifted layout, mobile-first) */}
      <header className="bg-white border-b border-[#E6ECF2] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              D
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#111827] text-xs sm:text-sm truncate">
                {HUB_NAME}
              </div>
              <div className="text-[11px] text-[#6B7A8C] hidden sm:block">Our visitors</div>
            </div>
          </Link>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#6B7A8C]">
              <Calendar className="w-3.5 h-3.5 text-[#34526E]" />
              {formatDayAndDate(new Date())}
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#34526E] hover:bg-[#EEF3F7] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content — Positioned cleanly near top of viewport */}
      <main className="flex-1 w-full px-4 sm:px-6 pt-5 sm:pt-8 pb-12">
        <div
          className={`w-full mx-auto ${mode === 'returning-action' || mode === 'returning-checkout'
            ? 'max-w-4xl'
            : 'max-w-xl'
            }`}
        >
          {/* Clean Page Header */}
          {mode !== 'success' && (
            <div className="mb-4 sm:mb-5">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1">
                {HUB_NAME.toUpperCase()} &middot; OUR VISITORS
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
                Clock In
              </h1>
            </div>
          )}

          {/* Main White Card */}
          <div className="bg-white rounded-2xl border border-[#E6ECF2] p-5 sm:p-7">
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {errorMessage}
              </div>
            )}

            {/* 1. NEW VISITOR FORM */}
            {mode === 'new' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  label="Full Name"
                  type="text"
                  required
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
                  helperText="Optional. Adding your phone number makes future check-ins faster."
                />

                <Input
                  label="Who are you here to see?"
                  type="text"
                  required
                  placeholder="e.g. Mr. Tunde / Programs Team / Co-working"
                  value={newHostName}
                  onChange={(e) => setNewHostName(e.target.value)}
                />

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button type="button" variant="secondary" onClick={resetFlow} className="min-h-[44px]">
                    Clear
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-6 min-h-[44px]">
                    {loading ? 'Clocking in...' : 'Clock In'}
                  </Button>
                </div>

                {/* Highly Visible Returning Visitor Callout */}
                <div className="pt-4 border-t border-[#E6ECF2]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('returning-lookup');
                      setErrorMessage(null);
                    }}
                    className="w-full min-h-[48px] p-3.5 rounded-xl bg-[#EEF3F7] hover:bg-[#E2ECF4] border border-[#DCE6EE] text-center transition"
                  >
                    <span className="text-base font-bold text-[#1E3A54]">
                      Already registered? For registered users &rarr;
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. RETURNING VISITOR: PHONE LOOKUP */}
            {mode === 'returning-lookup' && (
              <form onSubmit={handleLookup} className="space-y-4">
                <Input
                  label="Enter Your Phone Number or Full Name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 0803 123 4567 or Adebayo Ogunlesi"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  helperText="Use your phone number, or your full name if you registered without a phone number."
                />

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button type="button" variant="secondary" onClick={resetFlow} className="min-h-[44px]">
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-6 min-h-[44px]">
                    {loading ? 'Searching...' : 'Continue'}
                  </Button>
                </div>

                <div className="pt-4 border-t border-[#E6ECF2] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('new');
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center justify-center min-h-[44px] px-3 text-base font-semibold text-[#34526E] hover:text-[#1E3A54] underline underline-offset-4 transition"
                  >
                    If you&apos;re new here, click here
                  </button>
                </div>
              </form>
            )}

            {/* 3A. ALREADY SIGNED IN TODAY -> DIRECT PHONE-ONLY SIGN OUT (NO NAME CHECK) */}
            {mode === 'returning-checkout' && lookupResult && (
              <div className="space-y-7 text-center py-4 sm:py-8">
                <div className="p-6 sm:p-10 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#34526E]">
                    CURRENTLY SIGNED IN
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-extrabold text-[#111827] leading-[1.1] tracking-tight">
                    Ready to Sign Out?
                  </h2>
                  <p className="text-base text-[#475569]">
                    {lookupResult.maskedPhone !== 'Not provided' ? (
                      <>
                        Phone:{' '}
                        <span className="font-mono font-semibold">{lookupResult.maskedPhone}</span>
                      </>
                    ) : (
                      <>
                        Visitor:{' '}
                        <span className="font-semibold">{lookupResult.maskedName}</span>
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap justify-center items-center gap-4 text-sm sm:text-base text-[#475569] pt-1">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#34526E]" />
                      {formatDayAndDate(new Date(), { longMonth: true })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#34526E]" />
                      {formatTime(new Date())}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    type="button"
                    onClick={handleDirectClockOut}
                    isLoading={loading}
                    className="w-full sm:w-auto px-10 py-3.5 min-h-[52px] text-base sm:text-lg bg-amber-600 hover:bg-amber-700"
                  >
                    {loading ? 'Signing Out...' : 'Clock Out / Sign Out'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetFlow}
                    className="w-full sm:w-auto px-6 py-3.5 min-h-[52px] text-base"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* 3B. RETURNING VISITOR NOT YET SIGNED IN -> CONFIRM NAME & WHO THEY ARE HERE TO SEE */}
            {mode === 'returning-confirm' && lookupResult && (
              <form onSubmit={handleConfirmIdentity} className="space-y-4">
                <div className="p-4 rounded-xl bg-[#EEF3F7] border border-[#DCE6EE] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#34526E]">Profile Found</div>
                    <div className="text-lg font-bold text-[#111827] mt-0.5">
                      {lookupResult.maskedName}
                    </div>
                    <div className="text-xs text-[#6B7A8C]">{lookupResult.maskedPhone}</div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-[#475569] border border-[#DCE3EB]">
                    Clocked Out
                  </span>
                </div>

                <Input
                  label="Confirm Your Full Name to Clock In"
                  type="text"
                  required
                  autoFocus
                  placeholder="Type your registered full name"
                  value={confirmationName}
                  onChange={(e) => setConfirmationName(e.target.value)}
                />

                <Input
                  label="Who are you here to see?"
                  type="text"
                  required
                  placeholder="e.g. Mr. Tunde / Programs Team / Co-working"
                  value={returningHostName}
                  onChange={(e) => setReturningHostName(e.target.value)}
                />

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6ECF2]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMode('returning-lookup')}
                    className="min-h-[44px]"
                  >
                    Back
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-6 min-h-[44px]">
                    {loading ? 'Confirming...' : 'Continue'}
                  </Button>
                </div>
              </form>
            )}

            {/* 4. RETURNING VISITOR CONFIRMED -> CLOCK IN FOR TODAY (NO NAME IN WELCOME) */}
            {mode === 'returning-action' && confirmedAction && (
              <div className="space-y-7 text-center py-4 sm:py-8">
                <div className="p-6 sm:p-10 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] space-y-4">
                  <h2 className="text-3xl sm:text-5xl font-extrabold text-[#111827] leading-[1.1] tracking-tight">
                    Welcome to {HUB_NAME}
                  </h2>
                  {returningHostName.trim() && (
                    <div className="text-sm sm:text-base font-medium text-[#1E3A54]">
                      Here to see: <span className="font-bold">{returningHostName.trim()}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center items-center gap-4 text-sm sm:text-base text-[#475569] pt-1">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#34526E]" />
                      {formatDayAndDate(new Date(), { longMonth: true })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#34526E]" />
                      {formatTime(new Date())}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-sm sm:text-base text-amber-900 flex items-center justify-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
                  <span>
                    Click below to clock in for today. Remember that you must sign out / clock out when leaving.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={handleClockIn}
                    isLoading={loading}
                    className="w-full sm:w-auto px-10 py-3.5 min-h-[52px] text-base sm:text-lg"
                  >
                    {loading ? 'Clocking In...' : 'Clock In for Today'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetFlow}
                    className="w-full sm:w-auto px-6 py-3.5 min-h-[52px] text-base"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* 5. DONE / FULL-SCREEN WELCOME CONFIRMATION (NO NAME) */}
            {mode === 'success' && successInfo && (
              <div className="fixed inset-0 z-50 bg-[#F7F9FB] flex flex-col justify-center items-center p-5 sm:p-10 overflow-y-auto">
                <div className="w-full max-w-5xl bg-white rounded-3xl border border-[#E6ECF2] p-7 sm:p-14 lg:p-20 text-center space-y-7 shadow-sm">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-[#34526E] text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9 sm:w-12 sm:h-12" />
                  </div>

                  <div className="space-y-5">
                    <h2 className="text-3xl sm:text-6xl lg:text-7xl font-extrabold text-[#111827] leading-[1.08] tracking-tight">
                      {successInfo.title}
                    </h2>

                    <div className="p-4 sm:p-6 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] text-base sm:text-2xl font-medium text-[#1E3A54] max-w-4xl mx-auto leading-relaxed">
                      {successInfo.reminder}
                    </div>
                  </div>

                  <div className="inline-flex flex-wrap justify-center items-center gap-4 px-5 py-3 bg-[#F9FBFC] border border-[#E6ECF2] rounded-2xl text-sm sm:text-lg font-semibold text-[#1F2937]">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#34526E]" />
                      {successInfo.dayLabel}
                    </span>
                    <span className="text-[#CBD5E1]">|</span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#34526E]" />
                      {successInfo.timestamp}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button type="button" onClick={resetFlow} className="px-12 py-4 min-h-[52px] text-lg">
                      Done ({countdown}s)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center text-sm text-[#6B7A8C]">
          Loading...
        </div>
      }
    >
      <CheckInFlow />
    </Suspense>
  );
}
