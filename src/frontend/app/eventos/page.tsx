import { apiClient } from '@/lib/api';
import { SectionHead } from '@/components/section-head';
import { StatTile } from '@/components/stat-tile';

export const dynamic = 'force-dynamic';

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default async function EventosPage() {
  const stats = await apiClient.eventosStats().catch(() => null);

  if (!stats) {
    return (
      <div className="p-8 text-center rounded-sm" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
        Dados de eventos indisponíveis — verifique se o banco está populado.
      </div>
    );
  }

  const maxSazon = Math.max(...stats.sazonalidade.flatMap(s => [s.urgencias, s.agendamentos]), 1);

  return (
    <div className="space-y-8">
      <header>
        <p className="t-section-label">Padrão de deterioração</p>
        <h1 className="t-section-title">Eventos clínicos</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
          Urgências, agendamentos e a correlação entre visitas ACS e crises evitáveis.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile
          value={stats.total_eventos.toLocaleString('pt-BR')}
          label="Eventos registrados"
          sub="urgências + agendamentos"
          tone="neutral"
          big
        />
        <StatTile
          value={stats.total_urgencias.toLocaleString('pt-BR')}
          label="Urgências no período"
          sub={`${stats.pct_urgencias}% do total de eventos`}
          tone="urgente"
          big
        />
        <StatTile
          value={stats.espiral_count.toLocaleString('pt-BR')}
          label="Espiral de crises"
          sub="3+ urgências · sem visita ACS"
          tone="critico"
          big
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <SectionHead
            eyebrow="Sazonalidade"
            title="Urgências vs. agendamentos"
            sub="Últimos 12 meses do dataset."
          />
          <div className="rounded-sm p-4" style={{ border: '1px solid var(--grey-mid)', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {stats.sazonalidade.map(s => {
                const mesLabel = `${MESES_PT[s.mes - 1]}/${String(s.ano).slice(-2)}`;
                const urgH = Math.round((s.urgencias / maxSazon) * 100);
                const agdH = Math.round((s.agendamentos / maxSazon) * 100);
                return (
                  <div key={mesLabel} className="flex-1 flex flex-col items-center gap-0.5" title={`${mesLabel}: ${s.urgencias} urg / ${s.agendamentos} agd`}>
                    <div className="w-full flex items-end gap-px" style={{ height: 100 }}>
                      <div className="flex-1 rounded-t-sm" style={{ height: `${urgH}%`, background: 'var(--priority-1)', minHeight: 2 }} />
                      <div className="flex-1 rounded-t-sm" style={{ height: `${agdH}%`, background: 'var(--blue-light)', minHeight: 2 }} />
                    </div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--grey-text)' }}>
                      {MESES_PT[s.mes - 1]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#9b1c28' }}>
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--priority-1)' }} />
                Urgências
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--blue-secondary)' }}>
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--blue-light)' }} />
                Agendamentos
              </span>
            </div>
          </div>
        </section>

        <section>
          <SectionHead
            eyebrow="Correlação"
            title="Urgência precedida de visita?"
            sub="Para cada urgência, verificamos se houve visita ACS nos 30 dias anteriores."
          />
          <div className="rounded-sm p-6" style={{ border: '1px solid var(--grey-mid)', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center gap-6">
              <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
                  {(() => {
                    const r = 46, cx = 60, cy = 60;
                    const circ = 2 * Math.PI * r;
                    const sim = stats.urgencia_com_visita_pct;
                    const nao = stats.urgencia_sem_visita_pct;
                    const simArc = (sim / 100) * circ;
                    return (
                      <>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--priority-1)" strokeWidth={18} />
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--green-accent)" strokeWidth={18}
                          strokeDasharray={`${simArc} ${circ - simArc}`} strokeDashoffset="0"
                          transform={`rotate(-90 ${cx} ${cy})`} />
                        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="900" fill="#9b1c28" fontFamily="Cera Pro">{nao}%</text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b6b6b" fontWeight="700" letterSpacing="0.08em">S/ CONTATO</text>
                      </>
                    );
                  })()}
                </svg>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: 'var(--green-accent)' }} />
                  <div>
                    <p className="text-xl font-black" style={{ color: 'var(--grey-dark)' }}>{stats.urgencia_com_visita_pct}%</p>
                    <p className="text-xs" style={{ color: 'var(--grey-text)' }}>com visita prévia (30d)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: 'var(--priority-1)' }} />
                  <div>
                    <p className="text-xl font-black" style={{ color: '#9b1c28' }}>{stats.urgencia_sem_visita_pct}%</p>
                    <p className="text-xs" style={{ color: 'var(--grey-text)' }}>sem visita prévia</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--grey-text)' }}>
              <strong>{stats.urgencia_sem_visita_pct}% das crises</strong> ocorreram sem contato ACS nos 30 dias anteriores —
              sinal de cuidado preventivo insuficiente, não de eventos imprevisíveis.
            </p>
          </div>
        </section>
      </div>

      <section>
        <SectionHead
          eyebrow="Espiral de crises"
          title="Pacientes com 3+ urgências/ano"
          sub="Lista priorizada para vinculação imediata. 'Visitado antes?' = visita ACS nos 30 dias antes da última urgência."
        />
        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 480 }}>
              <thead>
                <tr style={{ background: 'var(--blue-primary)', color: '#fff' }}>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Perfil</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Urgências</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Última urgência</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Visitado?</th>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide hidden md:table-cell">Equipe</th>
                </tr>
              </thead>
              <tbody>
                {stats.espiral_table.map((r, i) => {
                  const perfil = [
                    r.gestacao  ? 'Gestante'    : null,
                    r.hipertenso ? 'Hipertenso' : null,
                    r.diabetico  ? 'Diabético'  : null,
                    r.faixa_etaria === '66+' ? 'Idoso 66+' : null,
                    r.faixa_etaria === '0-6' ? 'Criança 0-6' : null,
                  ].filter(Boolean).join(' · ') || r.faixa_etaria;
                  return (
                    <tr
                      key={r.paciente_id}
                      style={{ background: i % 2 === 0 ? '#fff' : 'var(--grey-card)', borderBottom: '1px solid var(--grey-mid)' }}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--grey-text)' }}>
                        #{r.paciente_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm hidden sm:table-cell">{perfil}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-black" style={{ color: '#9b1c28' }}>
                        {r.n_urgencias}
                      </td>
                      <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: 'var(--grey-text)' }}>
                        {r.ultima_urgencia ? new Date(r.ultima_urgencia).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.visitado_antes ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-sm" style={{ background: 'rgba(11,185,117,.12)', color: '#0a6b44' }}>✓ Sim</span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-sm" style={{ background: 'rgba(220,53,69,.10)', color: '#9b1c28' }}>✗ Não</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs hidden md:table-cell" style={{ color: 'var(--grey-text)' }}>
                        #{r.equipe_id.slice(0, 8)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)', borderTop: '1px solid var(--grey-mid)' }}>
            Top {stats.espiral_table.length} por volume de urgências · total na base: <strong>{stats.espiral_count.toLocaleString('pt-BR')}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
