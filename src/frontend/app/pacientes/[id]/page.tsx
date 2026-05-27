import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ScoreBadge } from '@/components/score-badge';
import { ClinicalTag, factorToTagKind } from '@/components/clinical-tag';
import type { RelatoVisita } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface Visita {
  id: number;
  profissional_id: string;
  registrados_em: string;
  paciente_id: string;
  origem: string;
}

interface EventoClinico {
  paciente_id: string;
  tipo: string;
  data_referencia: string;
}

interface Alerta {
  id: number;
  paciente_id: string;
  tipo: string;
  mensagem: string;
  prioridade: number;
  criado_em: string;
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  let relatos: RelatoVisita[] = [];
  try {
    [data, relatos] = await Promise.all([
      apiClient.patient(id),
      apiClient.relatosPaciente(id).catch(() => []),
    ]);
  } catch (err) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-black text-brand-blue-secondary">Paciente não encontrado</h1>
        <Link href="/pacientes" className="text-brand-blue-light underline mt-4 inline-block">← Voltar pra lista</Link>
      </div>
    );
  }
  const { paciente, visitas, eventos, alertas } = data as {
    paciente: typeof data.paciente;
    visitas: Visita[];
    eventos: EventoClinico[];
    alertas: Alerta[];
  };

  const tagKinds = Array.from(new Set(paciente.fatores.map(factorToTagKind)));

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/pacientes" className="text-xs text-brand-blue-primary font-bold uppercase tracking-wide">← Voltar pra lista</Link>
          <Link
            href={`/registrar?paciente_id=${paciente.paciente_id}`}
            className="text-xs font-black uppercase tracking-wide px-4 py-2 rounded-md"
            style={{ background: 'var(--blue-primary)', color: '#fff', minHeight: 36, display: 'inline-flex', alignItems: 'center' }}
          >
            + Registrar visita
          </Link>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <div>
            <p className="t-section-label">Paciente</p>
            <h1 className="text-2xl font-black text-brand-blue-secondary font-mono mt-1">
              #{paciente.paciente_id.slice(0, 16)}…
            </h1>
            <p className="text-grey-text mt-2">
              {paciente.faixa_etaria} · {paciente.sexo} · {paciente.raca_cor} · equipe #{paciente.equipe_id.slice(0, 8)}
            </p>
          </div>
          <ScoreBadge score={paciente.score} />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-grey-mid rounded-md p-5 shadow-sm">
          <p className="t-eyebrow mb-3">Comorbidades</p>
          <dl className="space-y-2 text-sm">
            <Row k="Gestante" v={paciente.gestacao ? 'Sim' : 'Não'} highlight={!!paciente.gestacao} />
            <Row k="Hipertenso" v={paciente.hipertenso ? 'Sim' : 'Não'} highlight={!!paciente.hipertenso} />
            <Row k="Diabético" v={paciente.diabetico ? 'Sim' : 'Não'} highlight={!!paciente.diabetico} />
            <Row k="Vulnerável" v={paciente.situacao_vulnerabilidade ? 'Sim' : 'Não'} highlight={!!paciente.situacao_vulnerabilidade} />
          </dl>
        </div>

        <div className="bg-white border border-grey-mid rounded-md p-5 shadow-sm">
          <p className="t-eyebrow mb-3">Fatores do score</p>
          <div className="space-y-2">
            {paciente.fatores.length === 0 ? (
              <p className="text-sm text-grey-text">Nenhum fator de risco identificado.</p>
            ) : (
              paciente.fatores.map(f => (
                <div key={f} className="text-sm flex items-start gap-2">
                  <span className="text-brand-blue-primary mt-0.5">•</span>
                  <span>{f.replace(/_/g, ' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-grey-mid rounded-md p-5 shadow-sm">
          <p className="t-eyebrow mb-3">Última visita</p>
          <p className="text-2xl font-black text-grey-dark">
            {paciente.ultima_visita ?? 'Nunca'}
          </p>
          {paciente.ultima_visita && <p className="text-sm text-grey-text mt-2">{visitas.length} visita{visitas.length > 1 ? 's' : ''} registrada{visitas.length > 1 ? 's' : ''}</p>}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {tagKinds.map(k => <ClinicalTag key={k} kind={k} />)}
      </section>

      <section>
        <h2 className="text-lg font-bold text-grey-dark mb-3">
          Alertas abertos ({alertas.length})
        </h2>
        <div className="space-y-2">
          {alertas.length === 0 ? (
            <p className="text-sm text-grey-text bg-grey-card rounded-sm p-4">Nenhum alerta aberto pra este paciente.</p>
          ) : alertas.map(a => (
            <div key={a.id} className="bg-white border border-grey-mid rounded-sm p-4 border-l-4 border-l-[var(--priority-2)]">
              <div className="flex justify-between items-start">
                <p className="text-xs text-brand-blue-primary font-bold uppercase tracking-wide">{a.tipo}</p>
                <span className="text-xs text-grey-text">{a.criado_em}</span>
              </div>
              <p className="text-sm mt-2">{a.mensagem}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Relatos de visita */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--grey-dark)' }}>
            Relatos de visita ACS ({relatos.length})
          </h2>
          <Link
            href={`/registrar?paciente_id=${paciente.paciente_id}`}
            className="text-xs font-black uppercase tracking-wide px-3 py-2 rounded-md"
            style={{ background: 'var(--blue-primary)', color: '#fff' }}
          >
            + Novo relato
          </Link>
        </div>
        {relatos.length === 0 ? (
          <div className="rounded-sm p-6 text-center" style={{ background: 'var(--grey-card)', border: '1px solid var(--grey-mid)' }}>
            <p className="text-sm" style={{ color: 'var(--grey-text)' }}>
              Nenhum relato registrado via app. Use{' '}
              <Link href={`/registrar?paciente_id=${paciente.paciente_id}`} style={{ color: 'var(--blue-primary)', fontWeight: 700 }}>
                Registrar Visita
              </Link>{' '}após cada visita domiciliar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relatos.map(r => (
              <RelatoCard key={r.id} relato={r} />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-bold text-grey-dark mb-3">Eventos clínicos ({eventos.length})</h2>
          {eventos.length === 0 ? (
            <p className="text-sm text-grey-text bg-grey-card rounded-sm p-4">Sem eventos clínicos.</p>
          ) : (
            <ul className="space-y-1 text-sm bg-grey-card rounded-sm p-4 max-h-64 overflow-y-auto">
              {eventos.slice(0, 30).map((e, i) => (
                <li key={i} className="flex justify-between">
                  <span className={e.tipo === 'urgencia-emergencia-ou-internacao' ? 'font-bold text-[var(--priority-1)]' : 'text-grey-text'}>
                    {e.tipo}
                  </span>
                  <span className="text-grey-text font-mono">{e.data_referencia}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold text-grey-dark mb-3">Visitas ({visitas.length})</h2>
          {visitas.length === 0 ? (
            <p className="text-sm text-grey-text bg-grey-card rounded-sm p-4">Sem visitas registradas.</p>
          ) : (
            <ul className="space-y-1 text-sm bg-grey-card rounded-sm p-4 max-h-64 overflow-y-auto">
              {visitas.slice(0, 30).map((v) => (
                <li key={v.id} className="flex justify-between">
                  <span className={v.origem === 'whatsapp' ? 'font-bold text-brand-green' : 'text-grey-text'}>
                    {v.origem === 'whatsapp' ? '💬 WhatsApp' : '📋 Sistema'}
                  </span>
                  <span className="text-grey-text font-mono">{v.registrados_em}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-grey-text">{k}</dt>
      <dd className={`font-bold ${highlight ? 'text-brand-blue-primary' : 'text-grey-dark'}`}>{v}</dd>
    </div>
  );
}

const CONDICAO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  estavel:     { bg: 'rgba(40,167,69,.10)',  text: '#1a6630', label: 'Estável' },
  com_queixas: { bg: 'rgba(255,193,7,.12)', text: '#856404', label: 'Com queixas' },
  urgente:     { bg: 'rgba(220,53,69,.10)', text: '#9b1c28', label: 'Urgente' },
};

function RelatoCard({ relato }: { relato: RelatoVisita }) {
  const cond = CONDICAO_STYLE[relato.condicao] ?? CONDICAO_STYLE.estavel;
  const checks = [
    relato.orientacoes_dadas        && 'Orientações dadas',
    relato.medicamentos_verificados && 'Medicamentos verificados',
    relato.sinais_vitais_verificados && 'Sinais vitais verificados',
    relato.encaminhamento_necessario && '⚠ Encaminhamento necessário',
    !relato.condicoes_moradia_ok    && '⚠ Moradia com problemas',
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-md overflow-hidden" style={{ background: '#fff', border: '1px solid var(--grey-mid)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: cond.bg }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cond.text }}>{cond.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--grey-text)' }}>
            {new Date(relato.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            {relato.acs_nome && <> · <strong>{relato.acs_nome}</strong></>}
          </p>
        </div>
        {!relato.paciente_encontrado && (
          <span className="text-xs font-bold px-2 py-1 rounded-sm" style={{ background: 'var(--grey-bar)', color: '#fff' }}>
            Não encontrado
          </span>
        )}
      </div>
      {(checks.length > 0 || relato.observacao) && (
        <div className="px-4 py-3 space-y-2">
          {checks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {checks.map(c => (
                <span
                  key={c}
                  className="text-xs font-bold px-2 py-0.5 rounded-sm"
                  style={{
                    background: c.startsWith('⚠') ? 'rgba(220,53,69,.08)' : 'rgba(0,74,128,.08)',
                    color: c.startsWith('⚠') ? '#9b1c28' : 'var(--blue-primary)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {relato.observacao && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--grey-dark)' }}>{relato.observacao}</p>
          )}
        </div>
      )}
    </div>
  );
}
