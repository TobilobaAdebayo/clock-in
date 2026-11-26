'use client';

import React from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg' | 'xl';
  onClose: () => void;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<'md' | 'lg' | 'xl', string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export function Modal({
  open,
  title,
  subtitle,
  size = 'md',
  onClose,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl ${SIZE_CLASSES[size]} w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto border border-[#E6ECF2]`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
            {subtitle && <p className="text-xs text-[#6B7A8C] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-[#EEF3F7] transition"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
