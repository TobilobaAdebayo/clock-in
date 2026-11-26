'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#34526E] hover:bg-[#294259] text-white shadow-sm disabled:opacity-50',
  secondary: 'bg-white border border-[#DCE3EB] hover:bg-[#F7F9FB] text-[#374151] disabled:opacity-50',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-50',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-[#EEF3F7] text-[#6B7A8C] hover:text-[#1E3A54] disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
