import React from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-[#F1F5F9] text-[#475569]',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/70',
  danger: 'bg-red-50 text-red-700 border border-red-200/70',
  info: 'bg-[#EEF3F7] text-[#2B465F] border border-[#DCE6EE]',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
