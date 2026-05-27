import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claude, SMALL_MODEL_ID } from './anthropic.js';
import type { CandidatoAgenda } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_TEMPLATE = readFileSync(
  resolve(__dirname, '../prompts/justificativa-visita.md'),
  'utf-8',
);

const FALLBACKS: Record<string, string> = {
  crise_sem_vinculo:
    'Paciente com histórico de urgências sem acompanhamento prévio. Realizar primeiro contato, avaliar situação e iniciar vínculo de cuidado.',
  urgencia_recente:
    'Paciente com atendimento de urgência recente. Verificar o que ocorreu, checar evolução e avaliar necessidade de encaminhamento.',
  invisivel:
    'Primeiro contato com este paciente. Apresentar-se, verificar condições de saúde e iniciar vínculo com a equipe.',
  gestante:
    'Gestante em acompanhamento. Verificar andamento do pré-natal, checar pressão arterial e adesão às orientações de saúde.',
  faixa_0_6:
    'Criança em faixa etária prioritária. Verificar desenvolvimento, calendário vacinal e condições gerais de saúde.',
  hipertenso_diabetico:
    'Paciente com hipertensão e diabetes. Verificar pressão arterial, glicemia, adesão à medicação e sinais de complicações.',
  hipertenso:
    'Paciente hipertenso. Verificar pressão arterial, adesão ao tratamento e eventuais queixas.',
  diabetico:
    'Paciente diabético. Verificar glicemia, pés, adesão ao tratamento e sinais de complicações.',
  idoso:
    'Idoso em acompanhamento. Verificar condições gerais, mobilidade, medicações e rede de suporte.',
  default:
    'Visita de acompanhamento rotineiro. Verificar condições gerais de saúde e necessidades do paciente.',
};

function fallback(c: CandidatoAgenda): string {
  if (c.flag_crise_sem_vinculo)                   return FALLBACKS.crise_sem_vinculo;
  if (c.n_urg_30d > 0)                            return FALLBACKS.urgencia_recente;
  if (c.flag_invisivel)                           return FALLBACKS.invisivel;
  if (c.gestacao === 1)                           return FALLBACKS.gestante;
  if (c.faixa_etaria === '0-6')                   return FALLBACKS.faixa_0_6;
  if (c.hipertenso === 1 && c.diabetico === 1)    return FALLBACKS.hipertenso_diabetico;
  if (c.hipertenso === 1)                         return FALLBACKS.hipertenso;
  if (c.diabetico === 1)                          return FALLBACKS.diabetico;
  if (c.faixa_etaria === '66+')                   return FALLBACKS.idoso;
  return FALLBACKS.default;
}

function montaContexto(c: CandidatoAgenda): string {
  const partes: string[] = [];

  if (c.flag_crise_sem_vinculo)
    partes.push(`${c.n_urg_ano} idas à urgência no último ano, sem nenhuma visita prévia do ACS`);
  else if (c.flag_invisivel)
    partes.push('nunca recebeu visita do ACS');

  const cond: string[] = [];
  if (c.gestacao === 1) cond.push('gestante');
  if (c.hipertenso === 1 && c.diabetico === 1) cond.push('hipertenso e diabético');
  else if (c.hipertenso === 1) cond.push('hipertenso');
  else if (c.diabetico === 1) cond.push('diabético');
  if (c.faixa_etaria === '0-6') cond.push('criança (0-6 anos)');
  if (c.faixa_etaria === '66+') cond.push('idoso (66+ anos)');
  if (c.situacao_vulnerabilidade === 1) cond.push('em situação de vulnerabilidade social');
  if (cond.length > 0) partes.push(`condições: ${cond.join(', ')}`);

  if (c.dias_sem_visita < 999) partes.push(`última visita há ${c.dias_sem_visita} dias`);
  else                          partes.push('sem registro de visitas anteriores');

  if (c.n_urg_30d > 0) partes.push(`${c.n_urg_30d} urgência(s) nos últimos 30 dias`);

  if (c.tem_agendamento_futuro) partes.push('tem consulta agendada próxima');

  return partes.length > 0 ? partes.join('; ') : 'sem condições especiais identificadas';
}

/**
 * Gera justificativa. Usa Claude Haiku se a env var ANTHROPIC_API_KEY estiver setada;
 * fallback determinístico em qualquer outro caso.
 */
export async function gerarJustificativa(c: CandidatoAgenda): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(c);

  const prompt = PROMPT_TEMPLATE.replace('{contexto}', montaContexto(c));

  try {
    const resp = await claude.messages.create({
      model: SMALL_MODEL_ID,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = resp.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') return fallback(c);
    return block.text.trim();
  } catch {
    return fallback(c);
  }
}
