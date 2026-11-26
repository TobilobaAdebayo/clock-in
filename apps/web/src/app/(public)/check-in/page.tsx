'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Calendar, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../../lib/format-date';
import { Button, Input } from '../../../components/ui';

type Mode =
  | 'new'
  | 'returning-lookup'
  | 'returning-confirm'
  | 'returning-checkout'
  | 'success';

interface LookupData {
  lookupToken: string;
  checkOutToken?: string | null;
  matchedBy?: 'phone';
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
  const router = useRouter();
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

  // Returning Visitor State (Phone Number Verification)
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupData | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [returningHostName, setReturningHostName] = useState('');

  // Full-Screen Welcome / Clock-Out Confirmation State
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    reminder: string;
    dayLabel: string;
    timestamp: string;
    status: 'CHECKED_IN' | 'CHECKED_OUT';
  } | null>(null);

  const [countdown, setCountdown] = useState(12);

  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  useEffect(() => {
    if (initialModeParam === 'returning') {
      setMode('returning-lookup');
    } else if (initialModeParam === 'new') {
      setMode('new');
    }
  }, [initialModeParam]);

  // Always reset scroll to top on screen transitions so the full DAIH header is immediately visible on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'success') {
      setCountdown(12);
      return;
    }
    const initialSeconds = successInfo?.status === 'CHECKED_OUT' ? 4 : 12;
    setCountdown(initialSeconds);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, successInfo?.status]);

  const resetFlow = () => {
    setMode(initialModeParam === 'returning' ? 'returning-lookup' : 'new');
    setFullName('');
    setPhoneNumber('');
    setNewHostName('');
    setLookupPhone('');
    setLookupResult(null);
    setConfirmationName('');
    setReturningHostName('');
    setSuccessInfo(null);
    setErrorMessage(null);
    setCountdown(12);
  };

  const handleSuccessDone = () => {
    const completedStatus = successInfo?.status;

    if (completedStatus === 'CHECKED_OUT') {
      router.replace('/');
      return;
    }

    resetFlow();

    if (completedStatus === 'CHECKED_IN') {
      setMode('returning-lookup');
      if (initialModeParam !== 'returning') {
        router.replace('/check-in?mode=returning');
      }
    }
  };

  useEffect(() => {
    if (mode === 'success' && countdown === 0) {
      handleSuccessDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countdown]);

  // 1. Register new visitor (phone number required) & clock in immediately
  const handleRegister = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<any>('/api/v1/public/visitors/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phoneNumber: phoneNumber.trim(),
          hostName: newHostName.trim(),
        }),
      });

      const now = new Date(res.data?.attendance?.checkIn || Date.now());

      setSuccessInfo({
        title: `Done! Welcome to ${HUB_NAME}`,
        reminder:
          'Please make sure you always clock in whenever you arrive and remember that you must clock out before leaving.',
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

  // 2. Returning visitor lookup strictly by registered phone number
  const handleLookup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<LookupData>('/api/v1/public/visitors/lookup', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: lookupPhone.trim() }),
      });

      const data = res.data!;
      setLookupResult(data);
      setConfirmationName('');
      setReturningHostName('');

      if (data.hasActiveSession && data.checkOutToken) {
        setMode('returning-checkout');
      } else {
        setMode('returning-confirm');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'No registered visitor found with this phone number.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Single post-verification step: confirm full name + who they are here to see -> Clock In directly
  const handleConfirmAndClockIn = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanHost = returningHostName.trim();
    if (!cleanHost) {
      setErrorMessage('Please enter who you are here to see today.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const confirmRes = await apiClient<ActionData>('/api/v1/public/visitors/confirm', {
        method: 'POST',
        body: JSON.stringify({
          lookupToken: lookupResult!.lookupToken,
          confirmationAnswer: confirmationName,
        }),
      });

      const checkInRes = await apiClient<any>('/api/v1/public/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          actionToken: confirmRes.data!.actionToken,
          hostName: cleanHost,
        }),
      });

      const now = new Date(checkInRes.data?.checkIn || Date.now());

      setSuccessInfo({
        title: `Done! Welcome once again to ${HUB_NAME}`,
        reminder:
          'Please make sure you always clock in whenever you arrive, and remember that you must clock out before leaving.',
        dayLabel: formatDayAndDate(now, { longMonth: true }),
        timestamp: formatTime(now),
        status: 'CHECKED_IN',
      });
      setMode('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not complete clock in.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Returning visitor Clock Out (direct via checkOutToken, no extra step)
  const handleDirectClockOut = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<any>('/api/v1/public/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ actionToken: lookupResult?.checkOutToken }),
      });

      const now = new Date(res.data?.checkOut || Date.now());

      setSuccessInfo({
        title: `Done! You have clocked out of ${HUB_NAME}`,
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
    <div className="min-h-[100dvh] w-full bg-[#F7F9FB] flex flex-col overflow-x-hidden">
      {/* Compact Responsive Top Bar — Full DAIH Name Always Visible */}
      <header className="bg-white border-b border-[#E6ECF2] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 min-h-[54px] py-2 flex items-center justify-between gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              D
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#111827] text-xs sm:text-sm leading-tight">
                {HUB_NAME}
              </div>
              <div className="text-[11px] text-[#6B7A8C] hidden sm:block">Our visitors</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#6B7A8C]">
              <Calendar className="w-3.5 h-3.5 text-[#34526E]" />
              {formatDayAndDate(new Date())}
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-[#34526E] hover:bg-[#EEF3F7] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content — Fits cleanly on all mobile & desktop screens */}
      <main className="flex-1 w-full px-3.5 sm:px-6 pt-3 sm:pt-7 pb-6 sm:pb-10">
        <div
          className={`w-full mx-auto ${
            mode === 'returning-checkout' ? 'max-w-3xl' : 'max-w-2xl'
          }`}
        >
          {/* Clean Page Header */}
          {mode !== 'success' && (
            <div className="mb-3 sm:mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
              <div>
                <div className="text-[10.5px] sm:text-[11px] font-semibold tracking-[0.06em] uppercase text-[#6B7A8C]">
                  {HUB_NAME.toUpperCase()} &middot; OUR VISITORS
                </div>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-[#111827] mt-0.5">
                  Clock In
                </h1>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] sm:hidden">
                <Calendar className="w-3.5 h-3.5 text-[#34526E]" />
                {formatDayAndDate(new Date())}
              </div>
            </div>
          )}

          {/* Main White Card */}
          <div className="bg-white rounded-2xl border border-[#E6ECF2] p-4 sm:p-7">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm">
                {errorMessage}
              </div>
            )}

            {/* 1. NEW VISITOR FORM (Phone Number Required) */}
            {mode === 'new' && (
              <form onSubmit={handleRegister} className="space-y-3.5 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <Input
                    label="Full Name"
                    type="text"
                    required
                    placeholder="e.g. Adebayo Ogunlesi"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="e.g. 0803 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>

                <Input
                  label="Who are you here to see?"
                  type="text"
                  required
                  placeholder="e.g. Mr. Tunde, Programs Team, or Co-working"
                  value={newHostName}
                  onChange={(e) => setNewHostName(e.target.value)}
                />

                <div className="flex items-center justify-end gap-2.5 pt-1.5">
                  <Button type="button" variant="secondary" onClick={resetFlow} className="min-h-[44px]">
                    Clear
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-7 min-h-[44px]">
                    {loading ? 'Clocking in...' : 'Clock In'}
                  </Button>
                </div>

                <div className="pt-3.5 border-t border-[#E6ECF2]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('returning-lookup');
                      setErrorMessage(null);
                    }}
                    className="w-full min-h-[46px] p-3 rounded-xl bg-[#EEF3F7] hover:bg-[#E2ECF4] border border-[#DCE6EE] text-center transition"
                  >
                    <span className="text-sm sm:text-base font-bold text-[#1E3A54]">
                      Already registered? For registered users &rarr;
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. RETURNING VISITOR: REGISTERED PHONE NUMBER VERIFICATION */}
            {mode === 'returning-lookup' && (
              <form onSubmit={handleLookup} className="space-y-4">
                <Input
                  label="Enter Your Registered Phone Number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  autoFocus
                  placeholder="e.g. 0803 123 4567"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  helperText="Your phone number confirms your profile as a returning visitor."
                />

                <div className="flex items-center justify-end gap-2.5 pt-1.5">
                  <Button type="button" variant="secondary" onClick={resetFlow} className="min-h-[44px]">
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-7 min-h-[44px]">
                    {loading ? 'Searching...' : 'Continue'}
                  </Button>
                </div>

                <div className="pt-3.5 border-t border-[#E6ECF2] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('new');
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center justify-center min-h-[44px] px-3 text-sm sm:text-base font-semibold text-[#34526E] hover:text-[#1E3A54] underline underline-offset-4 transition"
                  >
                    If you&apos;re new here, click here
                  </button>
                </div>
              </form>
            )}

            {/* 3A. ALREADY CLOCKED IN TODAY -> ONE-STEP CLOCK OUT */}
            {mode === 'returning-checkout' && lookupResult && (
              <div className="space-y-5 text-center py-2 sm:py-5">
                <div className="p-5 sm:p-8 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] space-y-2.5 sm:space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#34526E]">
                    CURRENTLY CLOCKED IN TODAY
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-[#111827] leading-[1.12] tracking-tight">
                    Ready to Clock Out?
                  </h2>
                  <p className="text-sm sm:text-base text-[#475569]">
                    Phone:{' '}
                    <span className="font-mono font-semibold">{lookupResult.maskedPhone}</span>
                  </p>
                  <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs sm:text-base text-[#475569] pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#34526E]" />
                      {formatDayAndDate(new Date(), { longMonth: true })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#34526E]" />
                      {formatTime(new Date())}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
                  <Button
                    type="button"
                    onClick={handleDirectClockOut}
                    isLoading={loading}
                    className="w-full sm:w-auto px-10 py-3 min-h-[48px] sm:min-h-[52px] text-base sm:text-lg bg-amber-600 hover:bg-amber-700"
                  >
                    {loading ? 'Clocking Out...' : 'Clock Out'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetFlow}
                    className="w-full sm:w-auto px-6 py-3 min-h-[48px] sm:min-h-[52px] text-base"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* 3B. ONE COMBINED PAGE AFTER PHONE VERIFICATION -> CONFIRM NAME + WHO TO SEE + CLOCK IN */}
            {mode === 'returning-confirm' && lookupResult && (
              <form onSubmit={handleConfirmAndClockIn} className="space-y-4">
                <div className="p-3.5 sm:p-5 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#34526E]">
                      Welcome to {HUB_NAME}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-[#111827] mt-0.5">
                      {lookupResult.maskedName}
                    </div>
                    <div className="text-xs text-[#6B7A8C] font-mono mt-0.5">
                      {lookupResult.maskedPhone}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold bg-white text-[#475569] border border-[#DCE3EB]">
                      Clocked Out
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#475569]">
                      <Clock className="w-3.5 h-3.5 text-[#34526E]" />
                      {formatTime(new Date())}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <Input
                    label="Confirm Your Full Name"
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
                    placeholder="e.g. Mr. Tunde, Programs Team, or Co-working"
                    value={returningHostName}
                    onChange={(e) => setReturningHostName(e.target.value)}
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Remember that you must clock out before leaving.</span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6ECF2]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMode('returning-lookup')}
                    className="min-h-[44px]"
                  >
                    Back
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-8 min-h-[44px]">
                    {loading ? 'Clocking in...' : 'Clock In'}
                  </Button>
                </div>
              </form>
            )}

            {/* 4. FULL-SCREEN WELCOME / CLOCK-OUT CONFIRMATION (FITS CLEANLY ON MOBILE) */}
            {mode === 'success' && successInfo && (
              <div className="fixed inset-0 z-50 bg-[#F7F9FB] flex flex-col p-4 sm:p-10 overflow-y-auto">
                <div className="my-auto w-full max-w-4xl mx-auto bg-white rounded-3xl border border-[#E6ECF2] p-5 sm:p-12 lg:p-16 text-center space-y-4 sm:space-y-6 shadow-sm">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#34526E] text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 sm:w-11 sm:h-11" />
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <h2 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold text-[#111827] leading-[1.12] tracking-tight">
                      {successInfo.title}
                    </h2>

                    <div className="p-3.5 sm:p-5 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] text-sm sm:text-xl font-medium text-[#1E3A54] max-w-3xl mx-auto leading-relaxed">
                      {successInfo.reminder}
                    </div>
                  </div>

                  <div className="inline-flex flex-wrap justify-center items-center gap-2.5 sm:gap-4 px-4 sm:px-5 py-2.5 bg-[#F9FBFC] border border-[#E6ECF2] rounded-2xl text-xs sm:text-base font-semibold text-[#1F2937]">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#34526E]" />
                      {successInfo.dayLabel}
                    </span>
                    <span className="text-[#CBD5E1]">|</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#34526E]" />
                      {successInfo.timestamp}
                    </span>
                  </div>

                  <div className="pt-1 sm:pt-2">
                    <Button
                      type="button"
                      onClick={handleSuccessDone}
                      className="w-full sm:w-auto px-10 sm:px-12 py-3.5 min-h-[48px] sm:min-h-[52px] text-base sm:text-lg"
                    >
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
        <div className="min-h-[100dvh] bg-[#F7F9FB] flex items-center justify-center text-sm text-[#6B7A8C]">
          Loading...
        </div>
      }
    >
      <CheckInFlow />
    </Suspense>
  );
}
