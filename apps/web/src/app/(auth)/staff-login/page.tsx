'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { Button, Input } from '../../../components/ui';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export default function StaffLoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    }
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
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Staff Portal</h1>
          </div>
        </div>

        {/* White Card */}
        <div className="bg-white rounded-2xl border border-[#E6ECF2] p-6 sm:p-8 space-y-5">
          <p className="text-xs text-[#6B7A8C]">
            Authorized Receptionist and Super Admin access only.
          </p>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Staff Email"
              type="email"
              required
              autoFocus
              placeholder="admin@clockin.workspace"
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
        </div>
      </div>
    </div>
  );
}
