'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth, TwoFactorChallenge } from '../../lib/auth-context';
import { Button, Input } from '../ui';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export interface PortalLoginFormProps {
  title: string;
  subtitle: string;
  placeholderEmail?: string;
  redirectOnLogin?: boolean;
}

export function PortalLoginForm({
  title,
  subtitle,
  placeholderEmail = 'admin@clockin.workspace',
  redirectOnLogin = true,
}: PortalLoginFormProps) {
  const { login, verifyTwoFactorLogin, resendTwoFactorLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    try {
      const outcome = await login(email, password, { redirect: redirectOnLogin });
      if (outcome.requiresTwoFactor) {
        setChallenge(outcome);
        setCode('');
        setInfoMessage(`We sent a 6-digit verification code to ${outcome.maskedEmail}.`);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    }
  };

  const handleVerifyCode = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setInfoMessage(null);

    try {
      await verifyTwoFactorLogin(challenge.challengeToken, code, { redirect: redirectOnLogin });
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
    }
  };

  const handleResend = async () => {
    if (!challenge) return;
    setError(null);
    setInfoMessage(null);
    setResending(true);

    try {
      const refreshed = await resendTwoFactorLogin(challenge.challengeToken);
      setChallenge(refreshed);
      setCode('');
      setInfoMessage(`A new verification code was sent to ${refreshed.maskedEmail}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    setChallenge(null);
    setCode('');
    setPassword('');
    setError(null);
    setInfoMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-base flex-shrink-0">
            D
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C]">
              {HUB_NAME.toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {challenge ? 'Two-Factor Verification' : title}
            </h1>
          </div>
        </div>

        {/* White Card */}
        <div className="bg-white rounded-2xl border border-[#E6ECF2] p-6 sm:p-8 space-y-5">
          {!challenge ? (
            <>
              <p className="text-xs text-[#6B7A8C]">{subtitle}</p>

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  autoFocus
                  placeholder={placeholderEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="flex items-center justify-end pt-3 border-t border-[#E6ECF2]">
                  <Button type="submit" isLoading={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#EEF3F7] border border-[#DCE6EE]">
                <ShieldCheck className="w-5 h-5 text-[#34526E] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[#1E3A54] leading-relaxed">
                  {infoMessage ||
                    `Enter the 6-digit verification code sent to ${challenge.maskedEmail}.`}
                </div>
              </div>

              {challenge.devPreviewCode && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Local dev preview (SMTP not configured): your code is{' '}
                  <span className="font-mono font-bold tracking-widest">
                    {challenge.devPreviewCode}
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
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
                  className="text-center font-mono text-xl tracking-[0.35em]"
                />

                <div className="flex items-center justify-between pt-3 border-t border-[#E6ECF2] gap-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-xs font-medium text-[#6B7A8C] hover:text-[#111827]"
                  >
                    &larr; Back
                  </button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleResend}
                      isLoading={resending}
                    >
                      {resending ? 'Sending...' : 'Resend'}
                    </Button>
                    <Button type="submit" isLoading={isLoading} disabled={code.length !== 6}>
                      {isLoading ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
