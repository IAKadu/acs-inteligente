import { scoreToPriority, priorityLabel } from '@/lib/api';

export function ScoreBadge({ score }: { score: number }) {
  const p = scoreToPriority(score);
  const styles: Record<number, { bg: string; color: string; border: string }> = {
    1: { bg: 'rgba(220,53,69,0.10)', color: '#9b1c28', border: 'var(--priority-1)' },
    2: { bg: 'rgba(253,126,20,0.10)', color: '#8d4a0c', border: 'var(--priority-2)' },
    3: { bg: 'rgba(255,193,7,0.15)', color: '#856404', border: 'var(--priority-3)' },
    4: { bg: 'rgba(40,167,69,0.10)', color: '#1a6630', border: 'var(--priority-4)' },
  };
  const s = styles[p];
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 font-bold text-xs uppercase tracking-wide"
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--radius-pill)',
      }}
    >
      <span className="font-mono text-sm">{Math.round(score)}</span>
      <span>{priorityLabel(p)}</span>
    </div>
  );
}
