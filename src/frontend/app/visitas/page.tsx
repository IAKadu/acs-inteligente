import { apiClient } from '@/lib/api';
import { SectionHead } from '@/components/section-head';
import { StatTile } from '@/components/stat-tile';

export const dynamic = 'force-dynamic';

function pctTone(pct: number): 'critico' | 'urgente' | 'atencao' | 'rotina' {
  if (pct < 50) return 'critico';
  if (pct < 65) return 'urgente';
  if (pct < 80) return 'atencao';
  return 'rotina';
}

export default async function VisitasPage() {
  const stats = await apiClient.visitasStats().catch(() => null);

  if (!stats) {
    return (
      <div className="p-8 text-center rounded-sm" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
        Dados de visitas indisponíveis — verifique se o banco está populado.
      </div>
    );
  }

  const maxVisitas = Math.max(...stats.top_profissionais.map(p => p.total_visitas));
  const maxCadencia = Math.max(...stats.cadencia.map(c => c.n));

  return (
    <div className="space-y-8">
      <header>
        <p className="t-section-label">Cobertura real</p>
        <h1 className="t-section-title">Visitas registradas</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
          Quem está sendo visitado, em que cadência, e quem ainda não foi alcançado.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile
          value={stats.total_registradas.toLocaleString('pt-BR')}
          label="Visitas registradas"
          sub="histórico total"
          tone="neutral"
          big
        />
        <StatTile
          value={`${stats.cobertura_pct}%`}
          label="Pacientes cobertos"
          sub={`${stats.com_visita.toLocaleString('pt-BR')} de ${stats.total_pacientes.toLocaleString('pt-BR')}`}
          tone={pctTone(stats.cobertura_pct)}
          big
        />
        <StatTile
          value={stats.sem_visita.toLocaleString('pt-BR')}
          label="Nunca visitados"
          sub="sem nenhum registro de visita"
          tone="critico"
          big
        />
      </section>

      <section>
        <SectionHead
          eyebrow="Déficit por perfil clínico"
          title="Onde a régua não é cumprida"
          sub="Média de visitas históricas por paciente vs. visitas esperadas pela régua de cuidado anual."
        />
        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ background: 'var(--blue-primary)', color: '#fff' }}>
                <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Perfil</th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Régua (vis/ano)</th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Média histórica</th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Déficit</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wide">Cumprimento</th>
              </tr>
            </thead>
            <tbody>
              {stats.deficit_perfil.map((r, i) => {
                const tone = pctTone(r.pct_cumprimento);
                const barColor =
                  tone === 'critico' ? 'var(--priority-1)' :
                  tone === 'urgente' ? 'var(--priority-2)' :
                  tone === 'atencao' ? 'var(--priority-3)' : 'var(--green-accent)';
                return (
                  <tr
                    key={r.perfil}
                    style={{ background: i % 2 === 0 ? '#fff' : 'var(--grey-card)', borderBottom: '1px solid var(--grey-mid)' }}
                  >
                    <td className="px-4 py-3 font-bold">{r.perfil}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{r.regua}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{r.realizadas.toFixed(1)}</td>
                    <td
                      className="px-4 py-3 text-right tabular-nums font-bold"
                      style={{ color: r.deficit < 0 ? '#9b1c28' : 'var(--green-accent)' }}
                    >
                      {r.deficit > 0 ? '+' : ''}{r.deficit.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'var(--grey-mid)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(r.pct_cumprimento, 100)}%`, background: barColor, transition: 'width .3s' }}
                          />
                        </div>
                        <span className="text-xs font-black w-10 text-right tabular-nums" style={{ color: barColor }}>
                          {r.pct_cumprimento}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <SectionHead
            eyebrow="Produtividade"
            title="Top 10 profissionais"
            sub="Profissionais com mais visitas registradas no histórico."
          />
          <div className="rounded-sm p-4 space-y-3" style={{ border: '1px solid var(--grey-mid)', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            {stats.top_profissionais.map(p => (
              <div key={p.profissional_id} className="flex items-center gap-3">
                <span className="font-mono text-xs w-28 shrink-0 truncate" style={{ color: 'var(--grey-text)' }}>
                  {p.profissional_id.slice(0, 12)}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 10, background: 'var(--grey-card)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(p.total_visitas / maxVisitas) * 100}%`, background: 'var(--blue-light)' }}
                  />
                </div>
                <span className="text-xs font-black w-10 text-right tabular-nums" style={{ color: 'var(--blue-secondary)' }}>
                  {p.total_visitas.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead
            eyebrow="Cadência"
            title="Dias desde a última visita"
            sub="Distribuição dos pacientes por tempo sem visita registrada."
          />
          <div className="rounded-sm p-4 space-y-3" style={{ border: '1px solid var(--grey-mid)', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            {stats.cadencia.map(c => {
              const isAlert = c.faixa === 'Nunca visitado' || c.faixa === '+180 dias';
              return (
                <div key={c.faixa} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-32 shrink-0" style={{ color: isAlert ? '#9b1c28' : 'var(--grey-text)' }}>
                    {c.faixa}
                  </span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 10, background: 'var(--grey-card)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.n / maxCadencia) * 100}%`,
                        background: isAlert ? 'var(--priority-1)' : 'var(--cyan-accent)',
                      }}
                    />
                  </div>
                  <span className="text-xs font-black w-14 text-right tabular-nums" style={{ color: isAlert ? '#9b1c28' : 'var(--grey-text)' }}>
                    {c.n.toLocaleString('pt-BR')}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
