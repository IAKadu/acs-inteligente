import type { ReactNode } from 'react';

interface SectionHeadProps {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}

export function SectionHead({ eyebrow, title, sub, action }: SectionHeadProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        {eyebrow && <p className="t-section-label mb-1">{eyebrow}</p>}
        <h2 className="text-2xl font-black" style={{ color: 'var(--blue-secondary)' }}>{title}</h2>
        {sub && (
          <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
            {sub}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
