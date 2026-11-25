import React from 'react';

export function PageHeader({
  eyebrow = 'DARE ADEBOYE INNOVATION HUB',
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1">
          {eyebrow}
        </div>
        <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#111827] leading-tight">
          {title}
        </h1>
        {description && <p className="text-sm text-[#6B7A8C] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </div>
  );
}
