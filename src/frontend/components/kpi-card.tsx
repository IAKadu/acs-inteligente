export function KpiCard({ label, value, hint, accent }: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'blue' | 'green' | 'cyan' | 'red';
}) {
  const borderColor = {
    blue: 'var(--blue-primary)',
    green: 'var(--green-accent)',
    cyan: 'var(--cyan-accent)',
    red: 'var(--priority-1)',
  }[accent ?? 'blue'];

  return (
    <div
      className="bg-white p-5 rounded-sm"
      style={{
        border: `1px solid var(--grey-mid)`,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="t-eyebrow">{label}</div>
      <div className="text-3xl font-black mt-1" style={{ color: 'var(--grey-dark)' }}>{value}</div>
      {hint && <div className="text-sm mt-1" style={{ color: 'var(--grey-text)' }}>{hint}</div>}
    </div>
  );
}
