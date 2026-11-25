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
  const { login, verifyTwoFactorLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    try {
      const outcome = await login(email, password, { redirect: redirectOnLogin });
      if (outcome.requiresTwoFactor) {
        setChallenge(outcome);
        setCode('');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    }
  };

  const handleVerifyCode = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!challenge) return;
    setError(null);

    try {
      await verifyTwoFactorLogin(challenge.challengeToken, code, { redirect: redirectOnLogin });
    } catch (err: any) {
      setError(err.message || 'Invalid Google Authenticator code.');
    }
  };

  const handleBack = () => {
    setChallenge(null);
    setCode('');
    setPassword('');
    setError(null);
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
              {challenge ? 'Google Authenticator' : title}
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
                  Open <strong>Google Authenticator</strong> on your phone and enter the 6-digit
                  code for your account.
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <Input
                  label="6-Digit Authenticator Code"
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

                  <Button type="submit" isLoading={isLoading} disabled={code.length !== 6}>
                    {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
