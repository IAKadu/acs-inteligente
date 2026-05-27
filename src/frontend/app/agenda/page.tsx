import { apiClient } from '@/lib/api';
import { EquipeSelector } from '@/components/equipe-selector';
import { AgendaSummary } from '@/components/agenda-summary';
import { AgendaCard } from '@/components/agenda-card';
import { AgendaMapSection } from '@/components/agenda-map-section';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ equipe_id?: string; capacidade?: string; com_justificativas?: string }>;
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const equipe_id = params.equipe_id;
  const capacidade = params.capacidade ? Number(params.capacidade) : 6;

  const equipes = await apiClient.equipesSedes().catch(() => []);

  let agenda = null as Awaited<ReturnType<typeof apiClient.agendaEquipe>> | null;
  let erro: string | null = null;
  if (equipe_id) {
    try {
      agenda = await apiClient.agendaEquipe(equipe_id, { capacidade, com_justificativas: true });
    } catch (err) {
      erro = (err as Error).message;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="t-section-label">ACS</p>
        <h1 className="t-section-title">Agenda do dia</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'var(--grey-text)' }}>
          Sequência otimizada de visitas para a equipe selecionada. Pacientes ordenados por
          proximidade geográfica a partir da sede, priorizados por score composto.
        </p>
      </header>

      <EquipeSelector equipes={equipes} initialEquipe={equipe_id} initialCapacidade={capacidade} />

      {!equipe_id && (
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
          Selecione uma equipe acima para gerar a agenda do dia.
        </div>
      )}

      {erro && (
        <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--p1-bg)', color: 'var(--p1-text)', border: '1px solid var(--p1-border)' }}>
          Erro: {erro}
        </div>
      )}

      {agenda && (
        <>
          <AgendaSummary agenda={agenda} />

          {agenda.total_itens === 0 ? (
            <div className="rounded-lg p-8 text-center" style={{ background: 'var(--grey-card)', color: 'var(--grey-text)' }}>
              Nenhum paciente prioritário encontrado pra essa equipe.
              <br />
              Os scores podem ainda não ter sido calculados — rodar o re-score completo.
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-xl font-black mb-3" style={{ color: 'var(--blue-secondary)' }}>
                  Rota
                </h2>
                <AgendaMapSection agenda={agenda} />
              </section>

              <section>
                <h2 className="text-xl font-black mb-3" style={{ color: 'var(--blue-secondary)' }}>
                  Sequência de visitas
                </h2>
                <div className="space-y-3">
                  {agenda.agenda.map(it => <AgendaCard key={it.paciente_id} item={it} />)}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
