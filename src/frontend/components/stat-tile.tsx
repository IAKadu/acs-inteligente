type Tone = 'neutral' | 'critico' | 'urgente' | 'atencao' | 'rotina';

const TONE: Record<Tone, { border: string; value: string }> = {
  neutral:  { border: 'var(--blue-primary)',   value: 'var(--grey-dark)' },
  critico:  { border: 'var(--priority-1)',      value: '#9b1c28' },
  urgente:  { border: 'var(--priority-2)',      value: '#8d4a0c' },
  atencao:  { border: 'var(--priority-3)',      value: '#856404' },
  rotina:   { border: 'var(--green-accent)',    value: 'var(--grey-dark)' },
};

interface StatTileProps {
  value: string | number;
  label: string;
  sub?: string;
  tone?: Tone;
  big?: boolean;
}

export function StatTile({ value, label, sub, tone = 'neutral', big = false }: StatTileProps) {
  const t = TONE[tone];
  return (
    <div
      className="bg-white rounded-sm p-5"
      style={{
        border: '1px solid var(--grey-mid)',
        borderLeft: `4px solid ${t.border}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className={big ? 'text-4xl font-black' : 'text-3xl font-black'}
        style={{ color: t.value }}
      >
        {value}
      </div>
      <div className="t-eyebrow mt-2">{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--grey-text)' }}>{sub}</div>}
    </div>
  );
}
