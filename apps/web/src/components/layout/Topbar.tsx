'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { formatDayAndDate } from '../../lib/format-date';

export interface TopbarProps {
  sectionLabel?: string;
}

/**
 * Minimal, non-redundant top bar for Receptionist & Super Admin views.
 * Avoids duplicating page-level search inputs or action buttons.
 */
export function Topbar({ sectionLabel = 'Dare Adeboye Innovation Hub' }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-[#E6ECF2] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-2 text-xs text-[#6B7A8C] min-w-0">
        <Calendar className="w-3.5 h-3.5 text-[#34526E] flex-shrink-0" />
        <span className="font-medium text-[#1F2937] truncate">{formatDayAndDate(new Date(), { longMonth: true })}</span>
        <span className="hidden sm:inline text-[#CBD5E1]">&middot;</span>
        <span className="hidden sm:inline truncate">{sectionLabel}</span>
      </div>

      <Link
        href="/check-in"
        className="px-3.5 py-1.5 rounded-lg bg-[#34526E] hover:bg-[#294259] text-white text-xs font-semibold transition flex-shrink-0"
      >
        Our visitors
      </Link>
    </header>
  );
}
