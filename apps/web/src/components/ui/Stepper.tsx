'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

/**
 * Signature left vertical stepper column matching the reference UI.
 */
export function Stepper({ steps, currentStepIndex, onStepClick }: StepperProps) {
  return (
    <ol className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
      {steps.map((step, idx) => {
        const isActive = idx === currentStepIndex;
        const isCompleted = idx < currentStepIndex;
        const clickable = Boolean(onStepClick && idx <= currentStepIndex);

        return (
          <li key={step.id} className="flex-shrink-0 md:flex-shrink">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(idx)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition ${
                isActive
                  ? 'bg-[#EEF3F7] text-[#1E3A54]'
                  : clickable
                  ? 'hover:bg-white/80 text-[#475569] cursor-pointer'
                  : 'text-[#6B7A8C] cursor-default'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition ${
                  isActive
                    ? 'bg-[#34526E] text-white'
                    : isCompleted
                    ? 'bg-[#DCE6EE] text-[#34526E]'
                    : 'bg-white border border-[#DCE3EB] text-[#6B7A8C]'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
              </span>
              <span
                className={`text-[13px] leading-snug ${
                  isActive ? 'font-semibold text-[#1E3A54]' : 'font-medium'
                }`}
              >
                {step.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
