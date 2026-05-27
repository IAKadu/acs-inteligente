import weights from '../config/scoring-weights.json' with { type: 'json' };
import {
  getPatient, getPatientVisits, getPatientEvents,
  upsertScore, countOpenAlertsP1,
} from './db.js';
import type { Prioridade } from '../types.js';

const TODAY = new Date('2025-12-31');

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function minimoVisitasAno(p: { faixa_etaria: string; gestacao: number; hipertenso: number; diabetico: number }): number {
  const r = weights.temporal_regua;
  if (p.faixa_etaria === '0-6')                  return r.crianca_0_6;
  if (p.gestacao === 1)                          return r.gestante;
  if (p.hipertenso === 1 && p.diabetico === 1)   return r.hipertenso_e_diabetico;
  if (p.hipertenso === 1)                        return r.hipertenso;
  if (p.diabetico === 1)                         return r.diabetico;
  if (p.faixa_etaria === '66+')                  return r.idoso_66_mais;
  return r.default;
}

function classificarPrioridade(score: number): Prioridade {
  const f = weights.faixas_prioridade;
  if (score >= f.critico) return 'CRITICO';
  if (score >= f.urgente) return 'URGENTE';
  if (score >= f.atencao) return 'ATENCAO';
  return 'ROTINA';
}

export interface ScoreBreakdown {
  score: number;
  fatores: string[];
  flag_invisivel: boolean;
  flag_crise_sem_vinculo: boolean;
  categoria_invisivel: 1 | 2 | 3 | null;
  prioridade: Prioridade;
}

export async function computeScore(paciente_id: string): Promise<ScoreBreakdown> {
  const p = await getPatient(paciente_id);
  if (!p) throw new Error(`paciente ${paciente_id} não existe`);

  const [visitas, eventos, n_alertas_p1] = await Promise.all([
    getPatientVisits(paciente_id),
    getPatientEvents(paciente_id),
    countOpenAlertsP1(paciente_id),
  ]);

  const fatores: string[] = [];
  let total = 0;

  // ── clínico ─────────────────────────────────────────────────────────────
  const c = weights.clinical;
  if (p.gestacao === 1)                                  { fatores.push('gestante');               total += c.gestante; }
  if (p.faixa_etaria === '0-6')                          { fatores.push('crianca_0_6');            total += c.crianca_0_6; }
  if (p.hipertenso === 1 && p.diabetico === 1)           { fatores.push('hipertenso_e_diabetico'); total += c.hipertenso_e_diabetico; }
  else if (p.hipertenso === 1)                           { fatores.push('hipertenso');             total += c.hipertenso; }
  else if (p.diabetico === 1)                            { fatores.push('diabetico');              total += c.diabetico; }
  if (p.faixa_etaria === '66+')                          { fatores.push('idoso_66_mais');          total += c.idoso_66_mais; }

  // ── social ──────────────────────────────────────────────────────────────
  if (p.situacao_vulnerabilidade === 1) {
    fatores.push('situacao_vulnerabilidade');
    total += weights.social.situacao_vulnerabilidade;
  }

  // ── temporal/régua ──────────────────────────────────────────────────────
  const min_visitas = minimoVisitasAno(p);
  const n_visitas = visitas.length;
  const deficit = Math.max(0, min_visitas - n_visitas);
  if (deficit > 0) {
    fatores.push(`deficit_${deficit}_visitas`);
    total += deficit * weights.temporal_regua.peso_por_visita_faltante;
  }

  // ── urgência (4 janelas cumulativas) ────────────────────────────────────
  const urgDates = eventos
    .filter(e => e.tipo === 'urgencia-emergencia-ou-internacao')
    .map(e => new Date(e.data_referencia));

  const n_30  = urgDates.filter(d => daysBetween(d, TODAY) <= 30).length;
  const n_90  = urgDates.filter(d => daysBetween(d, TODAY) <= 90).length;
  const n_180 = urgDates.filter(d => daysBetween(d, TODAY) <= 180).length;
  const n_ano = urgDates.length;

  const u = weights.urgencia;
  const scoreUrg = n_30 * u.peso_30d + n_90 * u.peso_90d + n_180 * u.peso_180d + n_ano * u.peso_ano;
  if (scoreUrg > 0) {
    if (n_30 > 0)  fatores.push(`urg_30d_${n_30}`);
    if (n_90 > 0)  fatores.push(`urg_90d_${n_90}`);
    if (n_180 > 0) fatores.push(`urg_180d_${n_180}`);
    if (n_ano > 0) fatores.push(`urg_ano_${n_ano}`);
    total += scoreUrg;
  }

  // ── agendamento futuro ──────────────────────────────────────────────────
  const temAgendFuturo = eventos.some(e =>
    e.tipo === 'agendamento' && new Date(e.data_referencia) > TODAY
  );
  if (temAgendFuturo) {
    fatores.push('agendamento_futuro');
    total += weights.agendamento.tem_agendamento_futuro;
  }

  // ── gatilho: alerta crítico aberto ──────────────────────────────────────
  if (n_alertas_p1 > 0) {
    fatores.push('alerta_critico_aberto');
    total += weights.gatilho.alerta_critico_aberto;
  }

  // ── bônus invisível ─────────────────────────────────────────────────────
  const altoRisco =
    p.gestacao === 1 ||
    p.faixa_etaria === '0-6' ||
    p.hipertenso === 1 ||
    p.diabetico === 1 ||
    p.faixa_etaria === '66+' ||
    p.situacao_vulnerabilidade === 1;

  const semVisita = n_visitas === 0;
  const flag_invisivel = semVisita && altoRisco;
  const flag_crise_sem_vinculo = semVisita && n_ano >= 3;

  if (flag_invisivel) {
    fatores.push('invisivel_alto_risco');
    total += weights.bonus_invisivel.alto_risco_sem_visita;
  }
  if (flag_crise_sem_vinculo) {
    fatores.push('crise_sem_vinculo');
    total += weights.bonus_invisivel.crise_sem_vinculo;
  }

  // ── categoria de invisível (apenas se sem visita) ───────────────────────
  let categoria_invisivel: 1 | 2 | 3 | null = null;
  if (semVisita) {
    if (n_ano >= 3)      categoria_invisivel = 1;       // crise sem vínculo
    else if (altoRisco)  categoria_invisivel = 2;       // alto risco sem contato
    else                 categoria_invisivel = 3;       // sem condição especial
  }

  const score = total;  // sem cap
  const prioridade = classificarPrioridade(score);

  return { score, fatores, flag_invisivel, flag_crise_sem_vinculo, categoria_invisivel, prioridade };
}

export async function recomputeAndSave(paciente_id: string): Promise<ScoreBreakdown> {
  const r = await computeScore(paciente_id);
  await upsertScore(paciente_id, r.score, r.fatores, null, {
    flag_invisivel: r.flag_invisivel,
    flag_crise_sem_vinculo: r.flag_crise_sem_vinculo,
    categoria_invisivel: r.categoria_invisivel,
    prioridade: r.prioridade,
  });
  return r;
}
