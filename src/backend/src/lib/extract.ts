import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claude, SMALL_MODEL_ID } from './anthropic.js';
import { sql } from './db.js';
import type { Paciente } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_TEMPLATE = readFileSync(
  resolve(__dirname, '../prompts/extract-message.md'),
  'utf-8',
);

export interface ExtractedData {
  paciente_referido: string | null;
  paciente_id_provavel: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  visita_realizada: boolean;
  sintomas_clinicos: string[];
  alertas: Array<{ tipo: string; prioridade: number; mensagem: string }>;
  familiares_citados: Array<{ relacao: string; sintoma: string }>;
  observacoes_livres: string;
  acoes_sugeridas: string[];
}

async function getCandidates(limit = 30): Promise<Paciente[]> {
  const rows = await sql<Paciente[]>`
    SELECT p.* FROM pacientes p
    JOIN pacientes_scores s ON s.paciente_id = p.paciente_id
    ORDER BY s.score DESC
    LIMIT ${limit}
  `;
  return rows;
}

function formatCandidates(candidates: Paciente[]): string {
  return candidates.map(c =>
    `- ${c.paciente_id} | equipe=${c.equipe_id.slice(0, 8)} | faixa=${c.faixa_etaria} sexo=${c.sexo} ${c.gestacao ? 'GESTANTE ' : ''}${c.hipertenso ? 'HIPER ' : ''}${c.diabetico ? 'DIAB ' : ''}${c.situacao_vulnerabilidade ? 'VULN' : ''}`,
  ).join('\n');
}

export async function extractMessage(text: string): Promise<ExtractedData> {
  const candidates = await getCandidates(30);
  const prompt = PROMPT_TEMPLATE
    .replace('{equipe_candidatos}', formatCandidates(candidates))
    .replace('{mensagem}', text);

  const response = await claude.messages.create({
    model: SMALL_MODEL_ID,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude não retornou texto');
  }

  const raw = textBlock.text.trim();
  const json = raw.startsWith('```')
    ? raw.replace(/^```json?\n/, '').replace(/\n```$/, '')
    : raw;

  return JSON.parse(json) as ExtractedData;
}
