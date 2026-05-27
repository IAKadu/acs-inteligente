import { Hono } from 'hono';
import { claude, SMALL_MODEL_ID } from '../lib/anthropic.js';

export const mediaRelato = new Hono();

export interface RelatoExtraido {
  paciente_encontrado: boolean;
  condicao: 'estavel' | 'com_queixas' | 'urgente';
  orientacoes_dadas: boolean;
  medicamentos_verificados: boolean;
  encaminhamento_necessario: boolean;
  sinais_vitais_verificados: boolean;
  condicoes_moradia_ok: boolean;
  observacao: string;
}

const SCHEMA_DESC = `
Retorne SOMENTE JSON válido (sem markdown, sem explicação) com estes campos:
{
  "paciente_encontrado": boolean,
  "condicao": "estavel" | "com_queixas" | "urgente",
  "orientacoes_dadas": boolean,
  "medicamentos_verificados": boolean,
  "encaminhamento_necessario": boolean,
  "sinais_vitais_verificados": boolean,
  "condicoes_moradia_ok": boolean,
  "observacao": string  // parágrafo curto e limpo para o campo de observações
}

Definições:
- condicao "estavel": paciente bem, sem queixas
- condicao "com_queixas": relata sintomas, mal-estar, dor, mas não é emergência
- condicao "urgente": sinais de emergência, piora grave, necessidade imediata de atendimento
- encaminhamento_necessario: true se o ACS mencionar encaminhar, marcar consulta ou levar ao serviço
- condicoes_moradia_ok: false se houver menção de problemas com higiene, saneamento, ventilação, risco estrutural
`.trim();

const AUDIO_PROMPT = `Você é um assistente especializado em Saúde da Família que extrai informações estruturadas de relatos verbais de visita domiciliar do ACS (Agente Comunitário de Saúde).

O seguinte texto é a transcrição de um relato de voz do ACS sobre uma visita domiciliar.

${SCHEMA_DESC}

Seja generoso na interpretação — se o ACS mencionar qualquer orientação, marque orientacoes_dadas como true.
Se não houver informação suficiente para um campo booleano, use o valor padrão mais seguro (false para riscos, true para condicoes_moradia_ok).`;

const IMAGE_PROMPT = `Você é um assistente especializado em Saúde da Família analisando uma imagem de visita domiciliar do ACS (Agente Comunitário de Saúde).

Analise cuidadosamente a imagem e identifique informações relevantes sobre:
- Condição visível do paciente (aparência, sinais de bem-estar ou sofrimento)
- Medicamentos visíveis (caixas, frascos, cartelas)
- Condições da moradia (higiene, organização, ventilação, risco estrutural visível)
- Materiais de saúde visíveis (equipamentos, documentos, cadernetas)
- Qualquer sinal de situação de urgência

${SCHEMA_DESC}

Para campos onde a imagem não fornece informação, use os valores padrão conservadores.
O campo observacao deve descrever de forma objetiva e útil o que é clinicamente relevante na imagem.`;

// POST /api/visitas/analisar-media
mediaRelato.post('/analisar-media', async (c) => {
  try {
    const body = await c.req.json<{
      tipo: 'transcript' | 'image';
      texto?: string;
      imagemBase64?: string;
      mimeType?: string;
    }>();

    let rawJson = '';

    if (body.tipo === 'transcript') {
      if (!body.texto?.trim()) {
        return c.json({ error: 'Campo texto obrigatório para tipo transcript' }, 400);
      }

      const response = await claude.messages.create({
        model: SMALL_MODEL_ID,
        max_tokens: 512,
        system: AUDIO_PROMPT,
        messages: [{ role: 'user', content: `Transcrição do relato: ${body.texto}` }],
      });

      rawJson = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

    } else if (body.tipo === 'image') {
      if (!body.imagemBase64) {
        return c.json({ error: 'Campo imagemBase64 obrigatório para tipo image' }, 400);
      }

      const mimeType = (body.mimeType ?? 'image/jpeg') as
        'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const response = await claude.messages.create({
        model: SMALL_MODEL_ID,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: body.imagemBase64 },
            },
            { type: 'text', text: IMAGE_PROMPT },
          ],
        }],
      });

      rawJson = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

    } else {
      return c.json({ error: 'tipo deve ser "transcript" ou "image"' }, 400);
    }

    // Clean any markdown fences Claude might wrap around the JSON
    const cleaned = rawJson.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const extracted: RelatoExtraido = JSON.parse(cleaned);
    return c.json(extracted);

  } catch (err) {
    console.error('media-relato error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});
