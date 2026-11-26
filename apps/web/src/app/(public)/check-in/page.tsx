'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Calendar, AlertCircle, ChevronRight } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatDayAndDate, formatTime } from '../../../lib/format-date';
import { Button, Input } from '../../../components/ui';

type Mode =
  | 'new'
  | 'returning-lookup'
  | 'returning-select'
  | 'returning-confirm'
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

type LookupResponse =
  | (LookupData & { multipleMatches?: false })
  | {
      multipleMatches: true;
      matchedBy: 'name';
      matches: LookupData[];
    };

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

  // Returning Visitor State
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMatches, setLookupMatches] = useState<LookupData[]>([]);
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
    setLookupMatches([]);
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

  const selectLookupProfile = (data: LookupData) => {
    setErrorMessage(null);
    setLookupResult(data);
    setConfirmationName('');
    setReturningHostName('');

    if (data.hasActiveSession && data.checkOutToken) {
      setMode('returning-checkout');
    } else {
      setMode('returning-confirm');
    }
  };

  // 1. Register new visitor & clock in immediately
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

  // 2. Returning visitor phone or full-name lookup
  const handleLookup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiClient<LookupResponse>('/api/v1/public/visitors/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: lookupPhone.trim() }),
      });

      const data = res.data!;
      if (data.multipleMatches && Array.isArray(data.matches) && data.matches.length > 0) {
        setLookupMatches(data.matches);
        setLookupResult(null);
        setMode('returning-select');
      } else {
        setLookupMatches([]);
        selectLookupProfile(data as LookupData);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Visitor not found.');
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
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col">
      {/* Compact Top Bar */}
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

      {/* Main Content — Spacious, well-utilized layout near top of viewport */}
      <main className="flex-1 w-full px-4 sm:px-6 pt-5 sm:pt-8 pb-12">
        <div
          className={`w-full mx-auto ${
            mode === 'returning-checkout' ? 'max-w-3xl' : 'max-w-2xl'
          }`}
        >
          {/* Clean Page Header */}
          {mode !== 'success' && (
            <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1">
                  {HUB_NAME.toUpperCase()} &middot; OUR VISITORS
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
                  Clock In
                </h1>
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#475569] sm:hidden">
                <Calendar className="w-3.5 h-3.5 text-[#34526E]" />
                {formatDayAndDate(new Date())}
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    helperText="Optional. Makes future visits faster."
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

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button type="button" variant="secondary" onClick={resetFlow} className="min-h-[44px]">
                    Clear
                  </Button>
                  <Button type="submit" isLoading={loading} className="px-7 min-h-[44px]">
                    {loading ? 'Clocking in...' : 'Clock In'}
                  </Button>
                </div>

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

            {/* 2. RETURNING VISITOR: PHONE OR FULL NAME LOOKUP */}
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
                  <Button type="submit" isLoading={loading} className="px-7 min-h-[44px]">
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

            {/* 2B. MULTIPLE PROFILES MATCHED BY NAME -> SELECT MASKED PROFILE */}
            {mode === 'returning-select' && lookupMatches.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Select Your Profile</h2>
                  <p className="text-sm text-[#6B7A8C] mt-1">
                    Multiple visitors are registered under this name. Tap your profile below, or go back and enter your phone number.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {lookupMatches.map((candidate, idx) => (
                    <button
                      key={`${candidate.lookupToken}-${idx}`}
                      type="button"
                      onClick={() => selectLookupProfile(candidate)}
                      className="w-full min-h-[64px] p-4 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF3F7] border border-[#DCE6EE] flex items-center justify-between gap-3 text-left transition"
                    >
                      <div className="min-w-0">
                        <div className="text-base font-bold text-[#111827] truncate">
                          {candidate.maskedName}
                        </div>
                        <div className="text-xs text-[#6B7A8C] mt-0.5">
                          {candidate.maskedPhone !== 'Not provided' ? (
                            <>
                              Phone:{' '}
                              <span className="font-mono font-semibold text-[#334155]">
                                {candidate.maskedPhone}
                              </span>
                            </>
                          ) : (
                            'No phone number on file'
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            candidate.hasActiveSession
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-white text-[#475569] border-[#DCE3EB]'
                          }`}
                        >
                          {candidate.hasActiveSession ? 'Clocked In' : 'Clocked Out'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#6B7A8C]" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6ECF2]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode('returning-lookup');
                    }}
                    className="min-h-[44px]"
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            {/* 3A. ALREADY CLOCKED IN TODAY -> ONE-STEP CLOCK OUT */}
            {mode === 'returning-checkout' && lookupResult && (
              <div className="space-y-6 text-center py-2 sm:py-5">
                <div className="p-6 sm:p-8 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#34526E]">
                    CURRENTLY CLOCKED IN TODAY
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] leading-[1.1] tracking-tight">
                    Ready to Clock Out?
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
                      <Calendar className="w-4 h-4 text-[#34526E]" />
                      {formatDayAndDate(new Date(), { longMonth: true })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#34526E]" />
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
                    {loading ? 'Clocking Out...' : 'Clock Out'}
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

            {/* 3B. ONE COMBINED PAGE AFTER VERIFYING PHONE OR FULL NAME -> CONFIRM NAME + WHO TO SEE + CLOCK IN */}
            {mode === 'returning-confirm' && lookupResult && (
              <form onSubmit={handleConfirmAndClockIn} className="space-y-5">
                <div className="p-4 sm:p-5 rounded-2xl bg-[#EEF3F7] border border-[#DCE6EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34526E]">
                      Welcome to {HUB_NAME}
                    </div>
                    <div className="text-xl font-bold text-[#111827] mt-0.5">
                      {lookupResult.maskedName}
                    </div>
                    <div className="text-xs text-[#6B7A8C] mt-0.5">
                      {lookupResult.maskedPhone !== 'Not provided'
                        ? lookupResult.maskedPhone
                        : 'No phone number on file'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-[#475569] border border-[#DCE3EB]">
                      Clocked Out
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#475569]">
                      <Clock className="w-3.5 h-3.5 text-[#34526E]" />
                      {formatTime(new Date())}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Remember that you must clock out before leaving.</span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6ECF2]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setMode(lookupMatches.length > 1 ? 'returning-select' : 'returning-lookup')
                    }
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

            {/* 4. FULL-SCREEN WELCOME / CLOCK-OUT CONFIRMATION */}
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
                    <Button type="button" onClick={handleSuccessDone} className="px-12 py-4 min-h-[52px] text-lg">
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
