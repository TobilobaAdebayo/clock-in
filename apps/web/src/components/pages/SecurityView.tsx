'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Input } from '../ui';

interface TotpSetupData {
  setupToken: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

export function TwoFactorCard() {
  const { user, updateUser } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await apiClient<{ twoFactorEnabled: boolean }>('/api/v1/auth/me');
        if (active && res.data) {
          setTwoFactorEnabled(Boolean(res.data.twoFactorEnabled));
          updateUser({ twoFactorEnabled: Boolean(res.data.twoFactorEnabled) });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleStartSetup = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      const res = await apiClient<TotpSetupData>('/api/v1/auth/2fa/setup', {
        method: 'POST',
      });
      if (res.data) {
        setSetupData(res.data);
        setCode('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start Google Authenticator setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.manualEntryKey.replace(/\s+/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleConfirmSetup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!setupData) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      await apiClient('/api/v1/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({
          setupToken: setupData.setupToken,
          code: code.trim(),
        }),
      });
      setTwoFactorEnabled(true);
      updateUser({ twoFactorEnabled: true });
      setSetupData(null);
      setCode('');
      setSuccessMessage('Google Authenticator 2FA is now enabled on your account.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid 6-digit code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      await apiClient('/api/v1/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setTwoFactorEnabled(false);
      updateUser({ twoFactorEnabled: false });
      setShowDisableForm(false);
      setPassword('');
      setSuccessMessage('Two-factor authentication has been turned off.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disable two-factor authentication.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8 space-y-5">
      {errorMessage && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200">
          {successMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#EEF3F7] text-[#34526E] flex items-center justify-center flex-shrink-0">
            {twoFactorEnabled ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-[#111827]">
                Two-Factor Authentication (Google Authenticator)
              </h2>
              {loadingProfile ? (
                <Badge tone="neutral">Checking...</Badge>
              ) : twoFactorEnabled ? (
                <Badge tone="success">Enabled</Badge>
              ) : (
                <Badge tone="neutral">Off</Badge>
              )}
            </div>
            <p className="text-xs text-[#6B7A8C] mt-1">
              Optional for staff. Turn on Google Authenticator 6-digit verification for your
              account ({user?.email}).
            </p>
          </div>
        </div>

        {!loadingProfile && !twoFactorEnabled && !setupData && (
          <Button onClick={handleStartSetup} isLoading={submitting} className="flex-shrink-0">
            {submitting ? 'Preparing...' : 'Set Up 2FA'}
          </Button>
        )}

        {!loadingProfile && twoFactorEnabled && !showDisableForm && (
          <Button
            variant="danger"
            onClick={() => {
              setShowDisableForm(true);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="flex-shrink-0"
          >
            Turn Off 2FA
          </Button>
        )}
      </div>

      {/* QR Code Setup Flow */}
      {setupData && (
        <form onSubmit={handleConfirmSetup} className="space-y-5 pt-4 border-t border-[#E6ECF2]">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center p-5 rounded-2xl bg-[#F9FBFC] border border-[#E6ECF2]">
            <div className="bg-white p-3 rounded-xl border border-[#DCE3EB] inline-flex justify-center mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setupData.qrCodeDataUrl}
                alt="Google Authenticator QR Code"
                width={180}
                height={180}
                className="w-44 h-44"
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#34526E]">
                  Step 1: Scan QR Code
                </div>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  Open <strong>Google Authenticator</strong>, tap <strong>+</strong> &rarr;{' '}
                  <strong>Scan a QR code</strong>, and scan this code.
                </p>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[#6B7A8C] mb-1">
                  Or enter setup key manually:
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-[#DCE3EB] rounded-lg text-xs font-mono font-semibold text-[#111827] tracking-wider select-all">
                    {setupData.manualEntryKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-2 rounded-lg border border-[#DCE3EB] bg-white hover:bg-[#EEF3F7] text-[#34526E] transition"
                    title="Copy setup key"
                    aria-label="Copy setup key"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#34526E]">
              Step 2: Enter 6-Digit Code
            </div>
            <Input
              label="Google Authenticator Code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="max-w-xs text-center font-mono text-xl tracking-[0.35em]"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <Button type="submit" isLoading={submitting} disabled={code.length !== 6}>
              {submitting ? 'Verifying...' : 'Verify & Enable'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSetupData(null);
                setCode('');
                setErrorMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Disable 2FA Form */}
      {showDisableForm && twoFactorEnabled && (
        <form onSubmit={handleDisable} className="space-y-4 pt-4 border-t border-[#E6ECF2]">
          <p className="text-sm text-[#475569]">
            Confirm your current password to turn off Google Authenticator 2FA.
          </p>

          <Input
            label="Current Password"
            type="password"
            required
            autoFocus
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="max-w-sm"
          />

          <div className="flex items-center gap-2.5 pt-2">
            <Button type="submit" variant="danger" isLoading={submitting}>
              {submitting ? 'Turning off...' : 'Confirm Turn Off'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDisableForm(false);
                setPassword('');
                setErrorMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function SecurityView() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Security (2FA)"
        description="Optional two-factor authentication using Google Authenticator."
      />
      <TwoFactorCard />
    </div>
  );
}
