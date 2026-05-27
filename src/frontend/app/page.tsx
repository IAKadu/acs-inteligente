import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { KpiCard } from '@/components/kpi-card';
import { PatientCard } from '@/components/patient-card';
import { MapSection } from '@/components/map-section';
import { PressaoTable } from '@/components/pressao-table';
import { InvisivelCounters } from '@/components/invisivel-counters';
import { SectionHead } from '@/components/section-head';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [kpis, topPatients, hotspots, equipes, painel, invisiveis] = await Promise.all([
    apiClient.kpis(),
    apiClient.patients({ limit: 12 }),
    apiClient.heatmap().catch(() => []),
    apiClient.equipesSedes().catch(() => []),
    apiClient.gestaoPainel().catch(() => []),
    apiClient.gestaoInvisiveis({ limit: 1 }).catch(() => ({ total: 0, por_categoria: { 1: 0, 2: 0, 3: 0 }, invisiveis: [] })),
  ]);

  const semVisita = kpis.total_pacientes - kpis.pacientes_visitados;
  const metaCobertura = 80;
  const coberturaDeficit = metaCobertura - kpis.cobertura_pct;
  const criticasSemCob = painel.filter(e => e.score_pressao >= 60).length;

  return (
    <div className="space-y-8">
      <header>
        <p className="t-section-label">Reunião Semanal</p>
        <h1 className="t-section-title">Inteligência no Território</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
          Visão do território com pacientes priorizados, alertas operacionais
          e concentração de risco. Ferramenta de apoio à decisão na reunião
          semanal da equipe de Saúde da Família.
        </p>
      </header>

      {/* Bloco de decisão */}
      <section>
        <p className="t-eyebrow mb-3">O que fazer agora</p>
        <div className="space-y-2">
          {/* Alert 1 */}
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-sm px-4 sm:px-5 py-4"
            style={{ border: '1px solid var(--priority-1)', background: 'rgba(220,53,69,.06)' }}
          >
            <span
              className="self-start sm:self-auto shrink-0 inline-block text-xs font-black uppercase tracking-wide px-2 py-1 rounded-sm"
              style={{ background: 'var(--priority-1)', color: '#fff' }}
            >
              Agir hoje
            </span>
            <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--grey-dark)' }}>
              <strong>{kpis.alertas_abertos} alertas abertos</strong> aguardam ação
              {criticasSemCob > 0 && <> · <strong>{criticasSemCob} equipes em estado crítico</strong></>}.
            </p>
            <Link
              href="/pacientes?score_min=70"
              className="self-start sm:self-auto shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-sm min-h-[36px] flex items-center"
              style={{ background: 'var(--priority-1)', color: '#fff' }}
            >
              Ver prioridades →
            </Link>
          </div>

          {/* Alert 2 */}
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-sm px-4 sm:px-5 py-4"
            style={{ border: '1px solid var(--priority-2)', background: 'rgba(253,126,20,.06)' }}
          >
            <span
              className="self-start sm:self-auto shrink-0 inline-block text-xs font-black uppercase tracking-wide px-2 py-1 rounded-sm"
              style={{ background: 'var(--priority-2)', color: '#fff' }}
            >
              Esta semana
            </span>
            <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--grey-dark)' }}>
              <strong>{kpis.cobertura_pct}% de cobertura</strong>
              {coberturaDeficit > 0 ? (
                <> — faltam <strong>{coberturaDeficit} pp</strong> para a meta de {metaCobertura}%.
                  {semVisita > 0 && <> <strong>{semVisita.toLocaleString('pt-BR')}</strong> pacientes nunca visitados.</>}
                </>
              ) : ' — meta de cobertura atingida.'}
            </p>
            <Link
              href="/visitas"
              className="self-start sm:self-auto shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-sm min-h-[36px] flex items-center"
              style={{ background: 'var(--priority-2)', color: '#fff' }}
            >
              Ver visitas →
            </Link>
          </div>

          {/* Alert 3 */}
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-sm px-4 sm:px-5 py-4"
            style={{ border: '1px solid var(--grey-mid)', background: 'var(--grey-card)' }}
          >
            <span
              className="self-start sm:self-auto shrink-0 inline-block text-xs font-black uppercase tracking-wide px-2 py-1 rounded-sm"
              style={{ background: 'var(--grey-bar)', color: '#fff' }}
            >
              Tendência
            </span>
            <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--grey-dark)' }}>
              <strong>{kpis.urgencias_30d.toLocaleString('pt-BR')} urgências nos últimos 30 dias</strong>
              {invisiveis.total > 0 && (
                <>. <strong>{invisiveis.total.toLocaleString('pt-BR')} pacientes invisíveis</strong> classificados no território.</>
              )}
            </p>
            <Link
              href="/eventos"
              className="self-start sm:self-auto shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-sm min-h-[36px] flex items-center"
              style={{ background: 'var(--grey-bar)', color: '#fff' }}
            >
              Ver eventos →
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Pacientes" value={kpis.total_pacientes.toLocaleString('pt-BR')} accent="blue" />
        <KpiCard
          label="Cobertura"
          value={`${kpis.cobertura_pct}%`}
          hint={`${kpis.pacientes_visitados.toLocaleString('pt-BR')} visitados`}
          accent="green"
        />
        <KpiCard label="Alertas abertos" value={kpis.alertas_abertos} accent="red" />
        <KpiCard label="Urgências 30d" value={kpis.urgencias_30d.toLocaleString('pt-BR')} accent="cyan" />
      </section>

      <section>
        <SectionHead
          title="Mapa do território"
          sub="Hotspots de urgência (vermelho) sobre o território. Clique em uma sede de equipe (azul) para ver o alcance a pé em 10 e 15 minutos."
        />
        <MapSection hotspots={hotspots} equipes={equipes} />
      </section>

      <section>
        <SectionHead
          title="Pacientes invisíveis"
          sub="Sem nenhuma visita registrada no ano, em 3 categorias. Grupo 1 (crise sem vínculo) = internados 3+ vezes sem vínculo com a equipe."
        />
        <InvisivelCounters data={invisiveis} />
      </section>

      <section>
        <SectionHead
          title="Pressão por equipe"
          sub="Ranking por score composto (40% alto risco + 40% sem visita + 20% urgência). Top 10 do território."
          action={
            <Link
              href="/equipes"
              className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-sm"
              style={{ background: 'var(--blue-primary)', color: '#fff' }}
            >
              Ver todas →
            </Link>
          }
        />
        <PressaoTable painel={painel} limit={10} />
      </section>

      <section>
        <SectionHead
          title="Top 12 prioridades"
          action={
            <Link
              href="/pacientes"
              className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-sm"
              style={{ background: 'var(--blue-primary)', color: '#fff' }}
            >
              Ver todos →
            </Link>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topPatients.map(p => <PatientCard key={p.paciente_id} patient={p} />)}
        </div>
      </section>
    </div>
  );
}
