import postgres from 'postgres';
import 'dotenv/config';
import type {
  Paciente, PacienteComScore, Visita, EventoClinico,
  RegistroWhatsapp, Alerta,
} from '../types.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada em .env');
}

export const sql = postgres(DATABASE_URL, {
  prepare: false,   // Supavisor transaction pooler requires prepare=false
  max: 10,
  idle_timeout: 20,
});

// ---------- queries ----------

export async function listPatients(filters: {
  equipe_id?: string;
  scoreMin?: number;
  scoreMax?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<PacienteComScore[]> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const rows = await sql<Array<PacienteComScore & { fatores: unknown }>>`
    SELECT p.*, s.score, s.fatores, s.justificativa,
           s.flag_invisivel, s.flag_crise_sem_vinculo, s.categoria_invisivel, s.prioridade,
           (SELECT MAX(registrados_em)::text FROM visitas WHERE paciente_id = p.paciente_id) AS ultima_visita
    FROM pacientes p
    LEFT JOIN pacientes_scores s ON s.paciente_id = p.paciente_id
    WHERE 1=1
      ${filters.equipe_id ? sql`AND p.equipe_id = ${filters.equipe_id}` : sql``}
      ${filters.scoreMin !== undefined ? sql`AND s.score >= ${filters.scoreMin}` : sql``}
      ${filters.scoreMax !== undefined ? sql`AND s.score <= ${filters.scoreMax}` : sql``}
    ORDER BY s.score DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;

  // fatores comes back as JSON object (array) from JSONB — no parse needed
  return rows.map(r => ({ ...r, fatores: Array.isArray(r.fatores) ? (r.fatores as string[]) : [] }));
}

export async function getPatient(id: string): Promise<PacienteComScore | null> {
  const rows = await sql<Array<PacienteComScore & { fatores: unknown }>>`
    SELECT p.*, s.score, s.fatores, s.justificativa,
           s.flag_invisivel, s.flag_crise_sem_vinculo, s.categoria_invisivel, s.prioridade,
           (SELECT MAX(registrados_em)::text FROM visitas WHERE paciente_id = p.paciente_id) AS ultima_visita
    FROM pacientes p
    LEFT JOIN pacientes_scores s ON s.paciente_id = p.paciente_id
    WHERE p.paciente_id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, fatores: Array.isArray(r.fatores) ? (r.fatores as string[]) : [] };
}

export async function getPatientVisits(id: string): Promise<Visita[]> {
  const rows = await sql<Visita[]>`
    SELECT id, profissional_id, registrados_em::text AS registrados_em,
           ordem_visita_dia, paciente_id, origem
    FROM visitas
    WHERE paciente_id = ${id}
    ORDER BY registrados_em DESC
  `;
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

export async function getPatientEvents(id: string): Promise<EventoClinico[]> {
  const rows = await sql<EventoClinico[]>`
    SELECT id, paciente_id, tipo, data_referencia::text AS data_referencia
    FROM eventos_clinicos
    WHERE paciente_id = ${id}
    ORDER BY data_referencia DESC
  `;
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

export async function getPatientAlerts(id: string): Promise<Alerta[]> {
  const rows = await sql<Alerta[]>`
    SELECT id, paciente_id, tipo, mensagem, prioridade, origem,
           criado_em::text AS criado_em, resolvido_em::text AS resolvido_em
    FROM alertas
    WHERE paciente_id = ${id} AND resolvido_em IS NULL
    ORDER BY criado_em DESC
  `;
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

export async function getOpenAlerts(limit = 50): Promise<Array<Alerta & { paciente_nome_proxy: string }>> {
  const rows = await sql<Array<Alerta & { paciente_nome_proxy: string }>>`
    SELECT a.id, a.paciente_id, a.tipo, a.mensagem, a.prioridade, a.origem,
           a.criado_em::text AS criado_em, a.resolvido_em::text AS resolvido_em,
           substr(a.paciente_id, 1, 12) AS paciente_nome_proxy
    FROM alertas a
    WHERE a.resolvido_em IS NULL
    ORDER BY a.prioridade ASC, a.criado_em DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

export async function getKpis() {
  const [{ n: total }] = await sql`SELECT COUNT(*)::int AS n FROM pacientes`;
  const [{ n: visitados }] = await sql`SELECT COUNT(DISTINCT paciente_id)::int AS n FROM visitas`;
  const [{ n: alertas_abertos }] = await sql`SELECT COUNT(*)::int AS n FROM alertas WHERE resolvido_em IS NULL`;
  const [{ n: urgencias_30d }] = await sql`
    SELECT COUNT(DISTINCT paciente_id)::int AS n
    FROM eventos_clinicos
    WHERE tipo = 'urgencia-emergencia-ou-internacao'
      AND data_referencia >= DATE '2025-12-31' - INTERVAL '30 days'
  `;
  return {
    total_pacientes: Number(total),
    pacientes_visitados: Number(visitados),
    cobertura_pct: Math.round((100 * Number(visitados)) / Number(total)),
    alertas_abertos: Number(alertas_abertos),
    urgencias_30d: Number(urgencias_30d),
  };
}

export async function getTerritoryHeatmap() {
  const rows = await sql<Array<{ lat: number; lng: number; n_urgencias: number }>>`
    SELECT
      ROUND(p.endereco_latitude::numeric, 3)::float AS lat,
      ROUND(p.endereco_longitude::numeric, 3)::float AS lng,
      COUNT(*)::int AS n_urgencias
    FROM eventos_clinicos e
    JOIN pacientes p ON p.paciente_id = e.paciente_id
    WHERE e.tipo = 'urgencia-emergencia-ou-internacao'
    GROUP BY lat, lng
    HAVING COUNT(*) >= 3
    ORDER BY n_urgencias DESC
    LIMIT 200
  `;
  return rows;
}

export async function insertVisita(v: Omit<Visita, 'id'>): Promise<number> {
  const [r] = await sql<Array<{ id: bigint }>>`
    INSERT INTO visitas (profissional_id, registrados_em, ordem_visita_dia, paciente_id, origem)
    VALUES (${v.profissional_id}, ${v.registrados_em}, ${v.ordem_visita_dia}, ${v.paciente_id}, ${v.origem})
    RETURNING id
  `;
  return Number(r.id);
}

export async function insertAlerta(a: Omit<Alerta, 'id' | 'criado_em' | 'resolvido_em'>): Promise<number> {
  const [r] = await sql<Array<{ id: bigint }>>`
    INSERT INTO alertas (paciente_id, tipo, mensagem, prioridade, origem)
    VALUES (${a.paciente_id}, ${a.tipo}, ${a.mensagem}, ${a.prioridade}, ${a.origem})
    RETURNING id
  `;
  return Number(r.id);
}

export async function upsertScore(
  paciente_id: string,
  score: number,
  fatores: string[],
  justificativa: string | null,
  flags: {
    flag_invisivel: boolean;
    flag_crise_sem_vinculo: boolean;
    categoria_invisivel: 1 | 2 | 3 | null;
    prioridade: 'CRITICO' | 'URGENTE' | 'ATENCAO' | 'ROTINA';
  },
): Promise<void> {
  await sql`
    INSERT INTO pacientes_scores
      (paciente_id, score, fatores, justificativa, calculado_em,
       flag_invisivel, flag_crise_sem_vinculo, categoria_invisivel, prioridade)
    VALUES (
      ${paciente_id}, ${score}, ${sql.json(fatores)}, ${justificativa}, NOW(),
      ${flags.flag_invisivel}, ${flags.flag_crise_sem_vinculo},
      ${flags.categoria_invisivel}, ${flags.prioridade}
    )
    ON CONFLICT (paciente_id) DO UPDATE SET
      score                  = EXCLUDED.score,
      fatores                = EXCLUDED.fatores,
      justificativa          = EXCLUDED.justificativa,
      calculado_em           = EXCLUDED.calculado_em,
      flag_invisivel         = EXCLUDED.flag_invisivel,
      flag_crise_sem_vinculo = EXCLUDED.flag_crise_sem_vinculo,
      categoria_invisivel    = EXCLUDED.categoria_invisivel,
      prioridade             = EXCLUDED.prioridade
  `;
}

export async function insertRegistroWhatsapp(
  r: Omit<RegistroWhatsapp, 'id' | 'recebido_em' | 'processado_em'>,
): Promise<number> {
  // dados_extraidos pode vir como string JSON ou null — armazenamos como JSONB
  const dados = r.dados_extraidos ? (typeof r.dados_extraidos === 'string' ? JSON.parse(r.dados_extraidos) : r.dados_extraidos) : null;
  const [row] = await sql<Array<{ id: bigint }>>`
    INSERT INTO registros_whatsapp
      (whatsapp_msg_id, from_number, profissional_id, mensagem_texto, dados_extraidos, paciente_id, status)
    VALUES (
      ${r.whatsapp_msg_id},
      ${r.from_number},
      ${r.profissional_id},
      ${r.mensagem_texto},
      ${dados ? sql.json(dados) : null},
      ${r.paciente_id},
      ${r.status}
    )
    RETURNING id
  `;
  return Number(row.id);
}

export async function updateRegistroWhatsapp(
  id: number,
  fields: Partial<RegistroWhatsapp>,
): Promise<void> {
  if ('dados_extraidos' in fields && typeof fields.dados_extraidos === 'string') {
    try { fields.dados_extraidos = JSON.parse(fields.dados_extraidos) as unknown as string; } catch { /* keep as-is */ }
  }
  // build dynamic UPDATE: faz sets só pros campos presentes
  const allowed: (keyof RegistroWhatsapp)[] = ['whatsapp_msg_id', 'from_number', 'profissional_id', 'mensagem_texto', 'dados_extraidos', 'paciente_id', 'status'];
  const updates = allowed.filter(k => k in fields);
  if (updates.length === 0) return;

  // Aplica updates um por um pra simplificar (poucos campos)
  for (const k of updates) {
    const v = (fields as Record<string, unknown>)[k];
    const value = (k === 'dados_extraidos' && v !== null && typeof v === 'object')
      ? sql.json(v as Parameters<typeof sql.json>[0])
      : v;
    await sql`UPDATE registros_whatsapp SET ${sql({ [k]: value })}, processado_em = NOW() WHERE id = ${id}`;
  }
}

// Helper exposto pra scoring.ts (uso interno)
export async function countOpenAlertsP1(paciente_id: string): Promise<number> {
  const [{ n }] = await sql<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM alertas
    WHERE paciente_id = ${paciente_id}
      AND prioridade = 1
      AND resolvido_em IS NULL
  `;
  return Number(n);
}

// Helper for chat-tools.ts query_group_stats
export async function queryGroupStats(equipe_id?: string) {
  const equipeCond = equipe_id ? sql`WHERE p.equipe_id = ${equipe_id}` : sql``;
  const rows = await sql<Array<{ grupo: string; n_total: number; n_visitados: number }>>`
    SELECT 'gestantes' AS grupo,
           SUM(p.gestacao)::int AS n_total,
           SUM(CASE WHEN p.gestacao=1 AND v.paciente_id IS NOT NULL THEN 1 ELSE 0 END)::int AS n_visitados
    FROM pacientes p
    LEFT JOIN (SELECT DISTINCT paciente_id FROM visitas) v USING(paciente_id)
    ${equipeCond}
    UNION ALL
    SELECT 'hipertensos',
           SUM(p.hipertenso)::int,
           SUM(CASE WHEN p.hipertenso=1 AND v.paciente_id IS NOT NULL THEN 1 ELSE 0 END)::int
    FROM pacientes p
    LEFT JOIN (SELECT DISTINCT paciente_id FROM visitas) v USING(paciente_id)
    ${equipeCond}
    UNION ALL
    SELECT 'diabeticos',
           SUM(p.diabetico)::int,
           SUM(CASE WHEN p.diabetico=1 AND v.paciente_id IS NOT NULL THEN 1 ELSE 0 END)::int
    FROM pacientes p
    LEFT JOIN (SELECT DISTINCT paciente_id FROM visitas) v USING(paciente_id)
    ${equipeCond}
    UNION ALL
    SELECT 'idosos_66',
           SUM(CASE WHEN p.faixa_etaria='66+' THEN 1 ELSE 0 END)::int,
           SUM(CASE WHEN p.faixa_etaria='66+' AND v.paciente_id IS NOT NULL THEN 1 ELSE 0 END)::int
    FROM pacientes p
    LEFT JOIN (SELECT DISTINCT paciente_id FROM visitas) v USING(paciente_id)
    ${equipeCond}
    UNION ALL
    SELECT 'vulneraveis',
           SUM(p.situacao_vulnerabilidade)::int,
           SUM(CASE WHEN p.situacao_vulnerabilidade=1 AND v.paciente_id IS NOT NULL THEN 1 ELSE 0 END)::int
    FROM pacientes p
    LEFT JOIN (SELECT DISTINCT paciente_id FROM visitas) v USING(paciente_id)
    ${equipeCond}
  `;
  return rows.map(r => ({
    ...r,
    n_total: Number(r.n_total ?? 0),
    n_visitados: Number(r.n_visitados ?? 0),
    pct_cobertura: r.n_total ? Math.round(100 * Number(r.n_visitados) / Number(r.n_total)) : 0,
  }));
}

// Resolve alerta (used by routes/alerts.ts)
export async function resolveAlerta(id: number): Promise<void> {
  await sql`UPDATE alertas SET resolvido_em = NOW() WHERE id = ${id}`;
}

// Equipes territory (used by routes/territory.ts)
export async function getEquipesSedes() {
  const rows = await sql<Array<{ equipe_id: string; lat: number; lng: number; n_pacientes: number }>>`
    SELECT e.equipe_id,
           e.endereco_latitude AS lat,
           e.endereco_longitude AS lng,
           (SELECT COUNT(*)::int FROM pacientes WHERE equipe_id = e.equipe_id) AS n_pacientes
    FROM equipes e
    WHERE e.endereco_latitude BETWEEN -23.5 AND -22.5
      AND e.endereco_longitude BETWEEN -43.9 AND -43.0
  `;
  return rows.map(r => ({ ...r, n_pacientes: Number(r.n_pacientes) }));
}

// ── Fase 2: painel de pressao e invisiveis ────────────────────────────────

export interface PainelEquipe {
  equipe_id: string;
  total_pacientes: number;
  pct_alto_risco: number;
  pct_sem_visita: number;
  pct_urgencia: number;
  score_pressao: number;
  crise_sem_vinculo: number;
  alto_risco_invisivel: number;
}

export async function getGestaoPainel(): Promise<PainelEquipe[]> {
  const rows = await sql<PainelEquipe[]>`
    WITH base AS (
      SELECT
        p.paciente_id,
        p.equipe_id,
        (p.gestacao = 1 OR p.faixa_etaria = '0-6' OR p.hipertenso = 1
          OR p.diabetico = 1 OR p.faixa_etaria = '66+' OR p.situacao_vulnerabilidade = 1) AS alto_risco,
        EXISTS (SELECT 1 FROM visitas v WHERE v.paciente_id = p.paciente_id)            AS visitado,
        EXISTS (SELECT 1 FROM eventos_clinicos e
                WHERE e.paciente_id = p.paciente_id
                  AND e.tipo = 'urgencia-emergencia-ou-internacao')                      AS teve_urgencia
      FROM pacientes p
    ),
    flags AS (
      SELECT
        p.equipe_id,
        SUM((s.categoria_invisivel = 1)::int)::int AS crise_sem_vinculo,
        SUM((s.flag_invisivel)::int)::int          AS alto_risco_invisivel
      FROM pacientes p
      LEFT JOIN pacientes_scores s USING (paciente_id)
      GROUP BY p.equipe_id
    )
    SELECT
      b.equipe_id,
      COUNT(*)::int                                                       AS total_pacientes,
      ROUND(100.0 * SUM(b.alto_risco::int)    / COUNT(*), 1)::float       AS pct_alto_risco,
      ROUND(100.0 * SUM((NOT b.visitado)::int)/ COUNT(*), 1)::float       AS pct_sem_visita,
      ROUND(100.0 * SUM(b.teve_urgencia::int) / COUNT(*), 1)::float       AS pct_urgencia,
      ROUND((
        100.0 * SUM(b.alto_risco::int)    / COUNT(*) * 0.4 +
        100.0 * SUM((NOT b.visitado)::int)/ COUNT(*) * 0.4 +
        100.0 * SUM(b.teve_urgencia::int) / COUNT(*) * 0.2
      )::numeric, 1)::float                                               AS score_pressao,
      COALESCE(f.crise_sem_vinculo, 0)::int                               AS crise_sem_vinculo,
      COALESCE(f.alto_risco_invisivel, 0)::int                            AS alto_risco_invisivel
    FROM base b
    LEFT JOIN flags f USING (equipe_id)
    GROUP BY b.equipe_id, f.crise_sem_vinculo, f.alto_risco_invisivel
    ORDER BY score_pressao DESC
  `;
  return rows;
}

export interface InvisivelRow {
  paciente_id: string;
  equipe_id: string;
  faixa_etaria: string;
  hipertenso: number;
  diabetico: number;
  gestacao: number;
  situacao_vulnerabilidade: number;
  n_urg_ano: number;
  score: number;
  prioridade: string | null;
  categoria_invisivel: 1 | 2 | 3;
  label_categoria: string;
}

const LABEL_INVISIVEL: Record<1 | 2 | 3, string> = {
  1: 'Crise sem vínculo',
  2: 'Alto risco sem contato',
  3: 'Sem contato (sem condição especial)',
};

export async function getInvisiveis(opts: {
  equipe_id?: string;
  categoria?: 1 | 2 | 3;
  limit?: number;
} = {}): Promise<{ total: number; por_categoria: Record<1|2|3, number>; invisiveis: InvisivelRow[] }> {
  const limit = opts.limit ?? 200;

  const por_cat = await sql<Array<{ categoria_invisivel: 1 | 2 | 3; n: number }>>`
    SELECT categoria_invisivel, COUNT(*)::int AS n
    FROM pacientes_scores s
    JOIN pacientes p USING (paciente_id)
    WHERE s.categoria_invisivel IS NOT NULL
      ${opts.equipe_id ? sql`AND p.equipe_id = ${opts.equipe_id}` : sql``}
    GROUP BY categoria_invisivel
    ORDER BY categoria_invisivel
  `;
  const por_categoria = { 1: 0, 2: 0, 3: 0 } as Record<1|2|3, number>;
  for (const r of por_cat) por_categoria[r.categoria_invisivel] = r.n;

  const rows = await sql<InvisivelRow[]>`
    SELECT
      p.paciente_id, p.equipe_id, p.faixa_etaria,
      p.hipertenso, p.diabetico, p.gestacao, p.situacao_vulnerabilidade,
      (SELECT COUNT(*)::int FROM eventos_clinicos e
        WHERE e.paciente_id = p.paciente_id
          AND e.tipo = 'urgencia-emergencia-ou-internacao')      AS n_urg_ano,
      s.score, s.prioridade, s.categoria_invisivel
    FROM pacientes_scores s
    JOIN pacientes p USING (paciente_id)
    WHERE s.categoria_invisivel IS NOT NULL
      ${opts.equipe_id ? sql`AND p.equipe_id = ${opts.equipe_id}` : sql``}
      ${opts.categoria ? sql`AND s.categoria_invisivel = ${opts.categoria}` : sql``}
    ORDER BY s.categoria_invisivel, s.score DESC
    LIMIT ${limit}
  `;

  const invisiveis: InvisivelRow[] = rows.map(r => ({
    ...r,
    label_categoria: LABEL_INVISIVEL[r.categoria_invisivel],
  }));

  const total = por_categoria[1] + por_categoria[2] + por_categoria[3];
  return { total, por_categoria, invisiveis };
}

// ── Fase 3: agenda diaria por equipe ──────────────────────────────────────

export interface EquipeSede {
  equipe_id: string;
  endereco_latitude: number;
  endereco_longitude: number;
}

export async function getEquipeSede(equipe_id: string): Promise<EquipeSede | null> {
  const rows = await sql<EquipeSede[]>`
    SELECT equipe_id, endereco_latitude, endereco_longitude
    FROM equipes
    WHERE equipe_id = ${equipe_id}
  `;
  return rows[0] ?? null;
}

export interface CandidatoAgenda {
  paciente_id: string;
  equipe_id: string;
  faixa_etaria: string;
  hipertenso: number;
  diabetico: number;
  gestacao: number;
  situacao_vulnerabilidade: number;
  endereco_latitude: number;
  endereco_longitude: number;
  score: number;
  prioridade: string | null;
  fatores: string[];
  flag_invisivel: boolean;
  flag_crise_sem_vinculo: boolean;
  ultima_visita: string | null;
  dias_sem_visita: number;
  n_urg_30d: number;
  n_urg_ano: number;
  tem_agendamento_futuro: boolean;
}

export async function getCandidatosAgenda(equipe_id: string, limit: number): Promise<CandidatoAgenda[]> {
  const rows = await sql<Array<CandidatoAgenda & { fatores: unknown; ultima_visita: string | null }>>`
    SELECT
      p.paciente_id, p.equipe_id, p.faixa_etaria,
      p.hipertenso, p.diabetico, p.gestacao, p.situacao_vulnerabilidade,
      p.endereco_latitude, p.endereco_longitude,
      COALESCE(s.score, 0)::float                                     AS score,
      s.prioridade,
      COALESCE(s.fatores, '[]'::jsonb)                                AS fatores,
      COALESCE(s.flag_invisivel, FALSE)                               AS flag_invisivel,
      COALESCE(s.flag_crise_sem_vinculo, FALSE)                       AS flag_crise_sem_vinculo,
      (SELECT MAX(registrados_em)::text FROM visitas v
        WHERE v.paciente_id = p.paciente_id)                          AS ultima_visita,
      COALESCE(
        (SELECT (DATE '2025-12-31' - MAX(registrados_em))::int FROM visitas v
          WHERE v.paciente_id = p.paciente_id),
        999
      )::int                                                          AS dias_sem_visita,
      (SELECT COUNT(*)::int FROM eventos_clinicos e
        WHERE e.paciente_id = p.paciente_id
          AND e.tipo = 'urgencia-emergencia-ou-internacao'
          AND e.data_referencia >= DATE '2025-12-31' - INTERVAL '30 days') AS n_urg_30d,
      (SELECT COUNT(*)::int FROM eventos_clinicos e
        WHERE e.paciente_id = p.paciente_id
          AND e.tipo = 'urgencia-emergencia-ou-internacao')           AS n_urg_ano,
      EXISTS(SELECT 1 FROM eventos_clinicos e
        WHERE e.paciente_id = p.paciente_id
          AND e.tipo = 'agendamento'
          AND e.data_referencia > DATE '2025-12-31')                  AS tem_agendamento_futuro
    FROM pacientes p
    LEFT JOIN pacientes_scores s USING (paciente_id)
    WHERE p.equipe_id = ${equipe_id}
      AND COALESCE(s.score, 0) > 0
    ORDER BY score DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({ ...r, fatores: Array.isArray(r.fatores) ? (r.fatores as string[]) : [] }));
}

// ── Fase 4: analytics de visitas e eventos ────────────────────────────────

export interface DeficitPerfil {
  perfil: string;
  regua: number;
  realizadas: number;
  deficit: number;
  pct_cumprimento: number;
}

export interface VisitasStats {
  total_registradas: number;
  total_pacientes: number;
  com_visita: number;
  sem_visita: number;
  cobertura_pct: number;
  deficit_perfil: DeficitPerfil[];
  top_profissionais: Array<{ profissional_id: string; total_visitas: number }>;
  cadencia: Array<{ faixa: string; n: number }>;
}

export async function getVisitasStats(): Promise<VisitasStats> {
  const [tot] = await sql<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM visitas`;
  const [cov] = await sql<Array<{ total: number; visitados: number }>>`
    SELECT COUNT(DISTINCT p.paciente_id)::int AS total,
           COUNT(DISTINCT v.paciente_id)::int AS visitados
    FROM pacientes p
    LEFT JOIN visitas v ON v.paciente_id = p.paciente_id
  `;

  const deficit_rows = await sql<Array<{ perfil: string; regua: number; realizadas: number }>>`
    WITH vpp AS (SELECT paciente_id, COUNT(*)::float AS n FROM visitas GROUP BY paciente_id),
    perfis AS (
      SELECT 'Gestantes'    AS perfil, 12 AS regua, p.paciente_id FROM pacientes p WHERE p.gestacao = 1
      UNION ALL
      SELECT 'Hipertensos',  4, p.paciente_id FROM pacientes p WHERE p.hipertenso = 1
      UNION ALL
      SELECT 'Diabéticos',   4, p.paciente_id FROM pacientes p WHERE p.diabetico  = 1
      UNION ALL
      SELECT 'Idosos 66+',   4, p.paciente_id FROM pacientes p WHERE p.faixa_etaria = '66+'
      UNION ALL
      SELECT 'Crianças 0-6', 6, p.paciente_id FROM pacientes p WHERE p.faixa_etaria = '0-6'
      UNION ALL
      SELECT 'Vulneráveis',  4, p.paciente_id FROM pacientes p WHERE p.situacao_vulnerabilidade = 1
    )
    SELECT perfil, regua,
           ROUND(AVG(COALESCE(vpp.n, 0))::numeric, 1)::float AS realizadas
    FROM perfis LEFT JOIN vpp USING(paciente_id)
    GROUP BY perfil, regua
    ORDER BY ROUND(AVG(COALESCE(vpp.n, 0))::numeric, 1)::float / regua
  `;

  const deficit_perfil: DeficitPerfil[] = deficit_rows.map(r => ({
    perfil: r.perfil,
    regua: Number(r.regua),
    realizadas: Number(r.realizadas),
    deficit: Math.round((Number(r.realizadas) - Number(r.regua)) * 10) / 10,
    pct_cumprimento: Math.round(100 * Number(r.realizadas) / Number(r.regua)),
  }));

  const top_prof = await sql<Array<{ profissional_id: string; total_visitas: number }>>`
    SELECT profissional_id, COUNT(*)::int AS total_visitas
    FROM visitas WHERE profissional_id IS NOT NULL
    GROUP BY profissional_id
    ORDER BY total_visitas DESC LIMIT 10
  `;

  const cadencia_rows = await sql<Array<{ faixa: string; n: number }>>`
    WITH ref AS (SELECT MAX(registrados_em) AS md FROM visitas),
    ultima AS (
      SELECT p.paciente_id, MAX(v.registrados_em) AS ultima_visita
      FROM pacientes p LEFT JOIN visitas v ON v.paciente_id = p.paciente_id
      GROUP BY p.paciente_id
    ),
    faixas AS (
      SELECT
        CASE
          WHEN ultima_visita IS NULL       THEN 'Nunca visitado'
          WHEN (md - ultima_visita) <= 30  THEN '0-30 dias'
          WHEN (md - ultima_visita) <= 90  THEN '31-90 dias'
          WHEN (md - ultima_visita) <= 180 THEN '91-180 dias'
          ELSE '+180 dias'
        END AS faixa
      FROM ultima, ref
    )
    SELECT faixa, COUNT(*)::int AS n
    FROM faixas
    GROUP BY faixa
    ORDER BY CASE faixa
      WHEN '0-30 dias'     THEN 1
      WHEN '31-90 dias'    THEN 2
      WHEN '91-180 dias'   THEN 3
      WHEN '+180 dias'     THEN 4
      ELSE 5 END
  `;

  const total_pacientes = Number(cov.total);
  const com_visita = Number(cov.visitados);
  return {
    total_registradas: Number(tot.n),
    total_pacientes,
    com_visita,
    sem_visita: total_pacientes - com_visita,
    cobertura_pct: Math.round(100 * com_visita / total_pacientes),
    deficit_perfil,
    top_profissionais: top_prof.map(r => ({ ...r, total_visitas: Number(r.total_visitas) })),
    cadencia: cadencia_rows.map(r => ({ faixa: r.faixa, n: Number(r.n) })),
  };
}

export interface EspiralRow {
  paciente_id: string;
  faixa_etaria: string;
  hipertenso: number;
  diabetico: number;
  gestacao: number;
  n_urgencias: number;
  ultima_urgencia: string;
  equipe_id: string;
  visitado_antes: boolean;
}

export interface EventosStats {
  total_eventos: number;
  total_urgencias: number;
  pct_urgencias: number;
  espiral_count: number;
  urgencia_com_visita_pct: number;
  urgencia_sem_visita_pct: number;
  sazonalidade: Array<{ ano: number; mes: number; urgencias: number; agendamentos: number }>;
  espiral_table: EspiralRow[];
}

export async function getEventosStats(): Promise<EventosStats> {
  const [tot] = await sql<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM eventos_clinicos`;
  const [urg] = await sql<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM eventos_clinicos WHERE tipo = 'urgencia-emergencia-ou-internacao'
  `;
  const [esp_count] = await sql<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT paciente_id FROM eventos_clinicos
      WHERE tipo = 'urgencia-emergencia-ou-internacao'
      GROUP BY paciente_id HAVING COUNT(*) >= 3
    ) t
  `;
  const [prec] = await sql<Array<{ com_visita: number; sem_visita: number }>>`
    SELECT
      SUM(CASE WHEN prev_visita THEN 1 ELSE 0 END)::int AS com_visita,
      SUM(CASE WHEN NOT prev_visita THEN 1 ELSE 0 END)::int AS sem_visita
    FROM (
      SELECT e.paciente_id,
        EXISTS (
          SELECT 1 FROM visitas v
          WHERE v.paciente_id = e.paciente_id
            AND v.registrados_em BETWEEN e.data_referencia - INTERVAL '30 days'
                                     AND e.data_referencia
        ) AS prev_visita
      FROM eventos_clinicos e
      WHERE e.tipo = 'urgencia-emergencia-ou-internacao'
    ) t
  `;

  const sazon_rows = await sql<Array<{ ano: number; mes: number; urgencias: number; agendamentos: number }>>`
    WITH ref AS (SELECT MAX(data_referencia) AS md FROM eventos_clinicos)
    SELECT
      EXTRACT(YEAR  FROM date_trunc('month', data_referencia))::int AS ano,
      EXTRACT(MONTH FROM date_trunc('month', data_referencia))::int AS mes,
      SUM(CASE WHEN tipo = 'urgencia-emergencia-ou-internacao' THEN 1 ELSE 0 END)::int AS urgencias,
      SUM(CASE WHEN tipo = 'agendamento'                       THEN 1 ELSE 0 END)::int AS agendamentos
    FROM eventos_clinicos, ref
    WHERE data_referencia >= date_trunc('month', md) - INTERVAL '11 months'
    GROUP BY date_trunc('month', data_referencia)
    ORDER BY date_trunc('month', data_referencia)
  `;

  const espiral_rows = await sql<Array<EspiralRow & { n_urgencias: unknown }>>`
    WITH urg AS (
      SELECT paciente_id, COUNT(*)::int AS n, MAX(data_referencia) AS ultima
      FROM eventos_clinicos
      WHERE tipo = 'urgencia-emergencia-ou-internacao'
      GROUP BY paciente_id HAVING COUNT(*) >= 3
    )
    SELECT
      u.paciente_id, p.faixa_etaria, p.hipertenso, p.diabetico, p.gestacao,
      u.n AS n_urgencias, u.ultima::text AS ultima_urgencia, p.equipe_id,
      EXISTS (
        SELECT 1 FROM visitas v
        WHERE v.paciente_id = u.paciente_id
          AND v.registrados_em BETWEEN u.ultima - INTERVAL '30 days' AND u.ultima
      ) AS visitado_antes
    FROM urg u JOIN pacientes p ON p.paciente_id = u.paciente_id
    ORDER BY u.n DESC LIMIT 20
  `;

  const total_eventos = Number(tot.n);
  const total_urgencias = Number(urg.n);
  const total_prec = Number(prec.com_visita) + Number(prec.sem_visita);

  return {
    total_eventos,
    total_urgencias,
    pct_urgencias: Math.round(100 * total_urgencias / total_eventos),
    espiral_count: Number(esp_count.n),
    urgencia_com_visita_pct: total_prec > 0 ? Math.round(100 * Number(prec.com_visita) / total_prec) : 0,
    urgencia_sem_visita_pct: total_prec > 0 ? Math.round(100 * Number(prec.sem_visita) / total_prec) : 0,
    sazonalidade: sazon_rows.map(r => ({
      ano: Number(r.ano), mes: Number(r.mes),
      urgencias: Number(r.urgencias), agendamentos: Number(r.agendamentos),
    })),
    espiral_table: espiral_rows.map(r => ({ ...r, n_urgencias: Number(r.n_urgencias), visitado_antes: Boolean(r.visitado_antes) })),
  };
}

// ─── Relatos de visita ────────────────────────────────────────────────────────

export interface RelatoVisita {
  id: number;
  paciente_id: string;
  equipe_id: string | null;
  acs_nome: string | null;
  criado_em: string;
  paciente_encontrado: boolean;
  condicao: 'estavel' | 'com_queixas' | 'urgente';
  orientacoes_dadas: boolean;
  medicamentos_verificados: boolean;
  encaminhamento_necessario: boolean;
  sinais_vitais_verificados: boolean;
  condicoes_moradia_ok: boolean;
  observacao: string | null;
}

export async function searchPatients(query: string, equipe_id?: string, limit = 20): Promise<PacienteComScore[]> {
  const rows = await sql<Array<PacienteComScore & { fatores: unknown }>>`
    SELECT p.*, s.score, s.fatores, s.prioridade,
           s.flag_invisivel, s.flag_crise_sem_vinculo, s.categoria_invisivel, s.justificativa,
           (SELECT MAX(registrados_em)::text FROM visitas WHERE paciente_id = p.paciente_id) AS ultima_visita
    FROM pacientes p
    LEFT JOIN pacientes_scores s ON s.paciente_id = p.paciente_id
    WHERE 1=1
      ${equipe_id ? sql`AND p.equipe_id = ${equipe_id}` : sql``}
      ${query ? sql`AND p.paciente_id::text ILIKE ${query + '%'}` : sql``}
    ORDER BY s.score DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map(r => ({ ...r, fatores: Array.isArray(r.fatores) ? (r.fatores as string[]) : [] }));
}

export async function createRelatoVisita(data: Omit<RelatoVisita, 'id' | 'criado_em'>): Promise<RelatoVisita> {
  const rows = await sql<RelatoVisita[]>`
    INSERT INTO visita_relatos (
      paciente_id, equipe_id, acs_nome,
      paciente_encontrado, condicao,
      orientacoes_dadas, medicamentos_verificados, encaminhamento_necessario,
      sinais_vitais_verificados, condicoes_moradia_ok, observacao
    ) VALUES (
      ${data.paciente_id}, ${data.equipe_id ?? null}, ${data.acs_nome ?? null},
      ${data.paciente_encontrado}, ${data.condicao},
      ${data.orientacoes_dadas}, ${data.medicamentos_verificados}, ${data.encaminhamento_necessario},
      ${data.sinais_vitais_verificados}, ${data.condicoes_moradia_ok}, ${data.observacao ?? null}
    )
    RETURNING *, criado_em::text AS criado_em, id::int AS id
  `;
  return rows[0];
}

export async function getRelatosVisita(paciente_id: string, limit = 30): Promise<RelatoVisita[]> {
  const rows = await sql<RelatoVisita[]>`
    SELECT *, criado_em::text AS criado_em, id::int AS id
    FROM visita_relatos
    WHERE paciente_id = ${paciente_id}
    ORDER BY criado_em DESC
    LIMIT ${limit}
  `;
  return rows;
}
