import type { Agenda } from '@/lib/api';

interface Props {
  agenda: Agenda;
}

export function AgendaSummary({ agenda }: Props) {
  const criticos = agenda.agenda.filter(a => a.prioridade === 'CRITICO').length;
  const urgentes = agenda.agenda.filter(a => a.prioridade === 'URGENTE').length;
  const invisiveis = agenda.agenda.filter(a => a.flag_invisivel || a.flag_crise_sem_vinculo).length;

  const items = [
    { label: 'Visitas',     value: agenda.total_itens, color: 'var(--blue-secondary)' },
    { label: 'Distância',   value: `${agenda.distancia_total_km.toFixed(1)} km`, color: 'var(--grey-dark)' },
    { label: 'Críticos',    value: criticos, color: 'var(--p1-text)' },
    { label: 'Urgentes',    value: urgentes, color: 'var(--p2-text)' },
    { label: 'Invisíveis',  value: invisiveis, color: 'var(--p3-text)' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map(it => (
        <div key={it.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--white)', border: '1px solid var(--grey-mid)' }}>
          <p className="text-2xl font-black" style={{ color: it.color }}>{it.value}</p>
          <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--grey-text)' }}>{it.label}</p>
        </div>
      ))}
    </div>
  );
}
