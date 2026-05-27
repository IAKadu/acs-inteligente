import { listPatients, getOpenAlerts, getKpis, queryGroupStats, getInvisiveis, getGestaoPainel } from './db.js';
import { buildAgenda } from './routing.js';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: object;
}

export const CHAT_TOOLS: ToolDef[] = [
  {
    name: 'query_patients',
    description: 'Lista pacientes ordenados por score, com filtros opcionais. Use pra responder "quem precisa de visita", "top pacientes vulneráveis", etc.',
    input_schema: {
      type: 'object',
      properties: {
        equipe_id: { type: 'string', description: 'Filtrar por equipe (hash)' },
        score_min: { type: 'number', description: 'Score mínimo (0-100)' },
        limit: { type: 'number', description: 'Máximo de resultados (default 20)' },
      },
    },
  },
  {
    name: 'query_alerts',
    description: 'Lista alertas abertos (não resolvidos), ordenados por prioridade.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Máximo (default 20)' },
      },
    },
  },
  {
    name: 'query_kpis',
    description: 'Retorna KPIs gerais: cobertura, total de pacientes, alertas abertos, urgências recentes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'query_group_stats',
    description: 'Estatísticas por grupo populacional: gestantes, idosos, hipertensos, diabéticos, vulneráveis. Retorna n_total, n_visitados, % cobertura.',
    input_schema: {
      type: 'object',
      properties: {
        equipe_id: { type: 'string', description: 'Opcional: filtrar por equipe' },
      },
    },
  },
  {
    name: 'query_invisiveis',
    description: 'Lista pacientes invisíveis (sem nenhuma visita registrada no ano), classificados em 3 categorias: 1=crise sem vínculo (3+ urgências e zero visita), 2=alto risco sem contato (gestante, criança 0-6, hipertenso, diabético, idoso 66+ ou vulnerável sem visita), 3=sem contato (sem condição especial). Filtros opcionais: equipe_id, categoria.',
    input_schema: {
      type: 'object',
      properties: {
        equipe_id: { type: 'string', description: 'Filtrar por equipe (opcional)' },
        categoria: { type: 'number', enum: [1, 2, 3], description: '1, 2 ou 3 (opcional)' },
        limit:     { type: 'number', description: 'Máximo de pacientes a retornar (default 50, max 200)' },
      },
    },
  },
  {
    name: 'query_painel_pressao',
    description: 'Retorna o painel de pressão por equipe: total de pacientes, % alto risco, % sem visita, % urgência e score de pressão (0–100). Ordenado por score_pressao desc.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'query_agenda_equipe',
    description: 'Gera a agenda diária otimizada de visitas para uma equipe específica. Retorna lista ordenada por proximidade geográfica (nearest neighbor a partir da sede), com top N pacientes por score. Use quando o usuário perguntar "qual a agenda da equipe X" ou "quem visitar amanhã na equipe Y".',
    input_schema: {
      type: 'object',
      properties: {
        equipe_id: { type: 'string', description: 'ID da equipe (obrigatório)' },
        capacidade: { type: 'number', description: 'Número de visitas (default 6, max 50)' },
        com_justificativas: { type: 'boolean', description: 'Se true, inclui justificativa por paciente (mais lento). Default false.' },
      },
      required: ['equipe_id'],
    },
  },
];

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'query_patients':
      return listPatients({
        equipe_id: input.equipe_id as string | undefined,
        scoreMin: input.score_min as number | undefined,
        limit: (input.limit as number | undefined) ?? 20,
      });
    case 'query_alerts':
      return getOpenAlerts((input.limit as number | undefined) ?? 20);
    case 'query_kpis':
      return getKpis();
    case 'query_group_stats':
      return queryGroupStats(input.equipe_id as string | undefined);
    case 'query_invisiveis': {
      const limit = Math.min((input.limit as number | undefined) ?? 50, 200);
      return getInvisiveis({
        equipe_id: input.equipe_id as string | undefined,
        categoria: input.categoria as 1 | 2 | 3 | undefined,
        limit,
      });
    }
    case 'query_painel_pressao':
      return getGestaoPainel();
    case 'query_agenda_equipe': {
      const equipe_id = input.equipe_id as string;
      const capacidade = input.capacidade as number | undefined;
      const com_justificativas = input.com_justificativas as boolean | undefined;
      const r = await buildAgenda({ equipe_id, capacidade, com_justificativas });
      if (!r) return { error: `equipe ${equipe_id} nao encontrada` };
      return r;
    }
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}
