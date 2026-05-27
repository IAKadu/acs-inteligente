import type { PainelEquipe } from '@/lib/api';

interface Props {
  painel: PainelEquipe[];
  limit?: number;
}

function pressaoColor(score: number): string {
  if (score >= 45) return 'var(--p1-text)';
  if (score >= 38) return 'var(--p2-text)';
  if (score >= 30) return 'var(--p3-text)';
  return 'var(--p4-text)';
}

export function PressaoTable({ painel, limit = 10 }: Props) {
  const top = painel.slice(0, limit);

  if (top.length === 0) {
    return (
      <div className="rounded-lg p-6 text-sm" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
        Sem dados de pressão por equipe ainda. Recalcular scores primeiro.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--white)', border: '1px solid var(--grey-mid)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--grey-card)' }}>
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px', letterSpacing: '0.08em' }}>Equipe</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>Pacientes</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>% Alto risco</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>% Sem visita</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>% Urgência</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>Pressão</th>
            <th className="text-right px-3 py-3 font-bold uppercase tracking-wide" style={{ color: 'var(--blue-dark)', fontSize: '11px' }}>Invisíveis</th>
          </tr>
        </thead>
        <tbody>
          {top.map(p => (
            <tr key={p.equipe_id} className="border-t" style={{ borderColor: 'var(--grey-mid)' }}>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--grey-dark)' }}>
                {p.equipe_id.slice(0, 8)}…
              </td>
              <td className="px-3 py-3 text-right" style={{ color: 'var(--grey-text)' }}>{p.total_pacientes.toLocaleString('pt-BR')}</td>
              <td className="px-3 py-3 text-right" style={{ color: 'var(--grey-text)' }}>{p.pct_alto_risco.toFixed(1)}%</td>
              <td className="px-3 py-3 text-right" style={{ color: 'var(--grey-text)' }}>{p.pct_sem_visita.toFixed(1)}%</td>
              <td className="px-3 py-3 text-right" style={{ color: 'var(--grey-text)' }}>{p.pct_urgencia.toFixed(1)}%</td>
              <td className="px-3 py-3 text-right font-bold" style={{ color: pressaoColor(p.score_pressao) }}>
                {p.score_pressao.toFixed(1)}
              </td>
              <td className="px-3 py-3 text-right" style={{ color: 'var(--grey-text)' }}>
                <span title="Alto risco sem visita">{p.alto_risco_invisivel}</span>
                {p.crise_sem_vinculo > 0 && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full font-bold" style={{ background: 'var(--p1-bg)', color: 'var(--p1-text)' }} title="Crise sem vínculo">
                    {p.crise_sem_vinculo} crise
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
