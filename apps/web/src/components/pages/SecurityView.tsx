'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Input } from '../ui';

interface EnableStartData {
  challengeToken: string;
  maskedEmail: string;
  expiresInSeconds: number;
  devPreviewCode?: string;
}

export function SecurityView() {
  const { user, updateUser } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Enable flow
  const [pendingEnable, setPendingEnable] = useState<EnableStartData | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Disable flow
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

  const handleStartEnable = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      const res = await apiClient<EnableStartData>('/api/v1/auth/2fa/enable/start', {
        method: 'POST',
      });
      if (res.data) {
        setPendingEnable(res.data);
        setCode('');
        setSuccessMessage(`A 6-digit verification code has been sent to ${res.data.maskedEmail}.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmEnable = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingEnable) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      await apiClient('/api/v1/auth/2fa/enable/confirm', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken: pendingEnable.challengeToken,
          code: code.trim(),
        }),
      });
      setTwoFactorEnabled(true);
      updateUser({ twoFactorEnabled: true });
      setPendingEnable(null);
      setCode('');
      setSuccessMessage('Two-factor authentication is now enabled on your account.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify code.');
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
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Security (2FA)"
        description="Manage email two-factor authentication for your account."
      />

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

      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6ECF2]">
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
                <h2 className="text-base font-bold text-[#111827]">Email Verification Code</h2>
                {loadingProfile ? (
                  <Badge tone="neutral">Checking...</Badge>
                ) : twoFactorEnabled ? (
                  <Badge tone="success">Enabled</Badge>
                ) : (
                  <Badge tone="neutral">Off</Badge>
                )}
              </div>
              <p className="text-xs text-[#6B7A8C] mt-1">
                When enabled, signing in requires a 6-digit code sent to{' '}
                <span className="font-medium text-[#1F2937]">{user?.email}</span>.
              </p>
            </div>
          </div>

          {!loadingProfile && !twoFactorEnabled && !pendingEnable && (
            <Button onClick={handleStartEnable} isLoading={submitting}>
              {submitting ? 'Sending...' : 'Enable 2FA'}
            </Button>
          )}

          {!loadingProfile && twoFactorEnabled && !showDisableForm && (
            <Button
              variant="secondary"
              onClick={() => {
                setShowDisableForm(true);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Turn Off 2FA
            </Button>
          )}
        </div>

        {/* Pending Enable Verification Form */}
        {pendingEnable && (
          <form onSubmit={handleConfirmEnable} className="space-y-4">
            <p className="text-sm text-[#475569]">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-[#111827]">{pendingEnable.maskedEmail}</span> to
              finish turning on 2FA.
            </p>

            {pendingEnable.devPreviewCode && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Local dev preview (SMTP not configured): your code is{' '}
                <span className="font-mono font-bold tracking-widest">
                  {pendingEnable.devPreviewCode}
                </span>
              </div>
            )}

            <Input
              label="6-Digit Verification Code"
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

            <div className="flex items-center gap-2.5 pt-2">
              <Button type="submit" isLoading={submitting} disabled={code.length !== 6}>
                {submitting ? 'Verifying...' : 'Confirm & Enable'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartEnable}
                disabled={submitting}
              >
                Resend Code
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPendingEnable(null);
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
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-[#475569]">
              Confirm your current password to turn off email two-factor authentication.
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
    </div>
  );
}
