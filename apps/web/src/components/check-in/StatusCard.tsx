'use client';

import React from 'react';

export interface StatusCardProps {
  title: string;
  description: string;
  dayLabel: string;
  timestamp: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT';
  countdown: number;
  onDone: () => void;
}

export function StatusCard({
  title,
  description,
  dayLabel,
  timestamp,
  status,
  countdown,
  onDone,
}: StatusCardProps) {
  return (
    <div className="text-center py-4 space-y-5">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold ${
          status === 'CHECKED_IN'
            ? 'bg-emerald-100 text-emerald-600'
            : 'bg-amber-100 text-amber-600'
        }`}
      >
        ✓
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700">
        <span>Day: {dayLabel}</span>
        <span className="hidden sm:inline text-slate-300">|</span>
        <span>Time: {timestamp}</span>
      </div>

      <div className="pt-4">
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition"
        >
          Done ({countdown}s)
        </button>
      </div>
    </div>
  );
}
