import Link from 'next/link';
import { apiClient, type PainelEquipe } from '@/lib/api';
import { SectionHead } from '@/components/section-head';
import { StatTile } from '@/components/stat-tile';

export const dynamic = 'force-dynamic';

type SortKey = 'score_pressao' | 'pct_sem_visita' | 'pct_urgencia' | 'pct_alto_risco' | 'crise_sem_vinculo';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'score_pressao',    label: 'Score de pressão' },
  { key: 'pct_sem_visita',   label: '% sem visita' },
  { key: 'pct_urgencia',     label: '% urgência' },
  { key: 'pct_alto_risco',   label: '% alto risco' },
  { key: 'crise_sem_vinculo', label: 'Crise sem vínculo' },
];

function scoreBand(score: number): { label: string; bg: string; fg: string } {
  if (score >= 60) return { label: 'CRÍTICO',  bg: 'rgba(220,53,69,.12)',  fg: '#9b1c28' };
  if (score >= 40) return { label: 'URGENTE',  bg: 'rgba(253,126,20,.12)', fg: '#8d4a0c' };
  if (score >= 20) return { label: 'ATENÇÃO',  bg: 'rgba(255,193,7,.16)',  fg: '#856404' };
  return             { label: 'ROTINA',   bg: 'rgba(40,167,69,.12)',  fg: '#1a6630' };
}

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function EquipesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? 'score_pressao') as SortKey;

  const [painel, kpis] = await Promise.all([
    apiClient.gestaoPainel().catch(() => [] as PainelEquipe[]),
    apiClient.kpis().catch(() => null),
  ]);

  const sorted = [...painel].sort((a, b) => (b[sort] as number) - (a[sort] as number));

  const total_equipes = painel.length;
  const criticas = painel.filter(e => e.score_pressao >= 60).length;
  const media_cobertura = painel.length
    ? Math.round(painel.reduce((s, e) => s + (100 - e.pct_sem_visita), 0) / painel.length)
    : 0;

  return (
    <div className="space-y-8">
      <header>
        <p className="t-section-label">Ranking</p>
        <h1 className="t-section-title">Equipes por pressão</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
          Score combina déficit de visitas, urgências recentes e perfil clínico.
          Maior = situação mais tensa. Clique no cabeçalho para reordenar.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile value={total_equipes} label="Equipes ativas" tone="neutral" />
        <StatTile value={criticas} label="Em estado crítico" sub="Score ≥ 60" tone="critico" />
        <StatTile value={`${media_cobertura}%`} label="Cobertura média" sub="% com ao menos 1 visita" tone="neutral" />
        <StatTile value={kpis?.alertas_abertos ?? '—'} label="Alertas abertos" tone="urgente" />
      </section>

      <section>
        <SectionHead
          eyebrow="Todas as equipes"
          title="Tabela de pressão"
          sub="Ordenar por coluna via link. Equipe com crise sem vínculo = pacientes internados 3+ vezes sem visita ACS."
          action={
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(o => (
                <Link
                  key={o.key}
                  href={`/equipes?sort=${o.key}`}
                  className="px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wide border transition-colors"
                  style={sort === o.key
                    ? { background: 'var(--blue-primary)', color: '#fff', borderColor: 'var(--blue-primary)' }
                    : { background: 'var(--grey-card)', color: 'var(--grey-text)', borderColor: 'var(--grey-mid)' }
                  }
                >
                  {o.label}
                </Link>
              ))}
            </div>
          }
        />

        <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ background: 'var(--blue-primary)', color: '#fff' }}>
                  <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Equipe</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Pacientes</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">% Alto Risco</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">% Sem Visita</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide hidden sm:table-cell">% Urgência</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Crise s/ Vínculo</th>
                  <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Score</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => {
                  const band = scoreBand(e.score_pressao);
                  return (
                    <tr
                      key={e.equipe_id}
                      style={{ background: i % 2 === 0 ? '#fff' : 'var(--grey-card)', borderBottom: '1px solid var(--grey-mid)' }}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--grey-dark)' }}>
                        #{e.equipe_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{e.total_pacientes.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{e.pct_alto_risco.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.pct_sem_visita.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{e.pct_urgencia.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: e.crise_sem_vinculo > 0 ? '#9b1c28' : 'inherit' }}>
                        {e.crise_sem_vinculo}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="inline-block px-2 py-0.5 rounded-sm text-xs font-black tabular-nums"
                          style={{ background: band.bg, color: band.fg }}
                        >
                          {e.score_pressao.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)', borderTop: '1px solid var(--grey-mid)' }}>
            {sorted.length} equipes · ordenado por <strong>{SORT_OPTIONS.find(o => o.key === sort)?.label}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
