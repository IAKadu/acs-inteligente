// Allow JSON.stringify to serialize BigInt (postgres driver returns BIGSERIAL ids as BigInt)
// @ts-expect-error: patching built-in BigInt
BigInt.prototype.toJSON = function() { return Number(this); };

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import 'dotenv/config';

import {
  getKpis,
  listPatients,
  getPatient,
  getPatientVisits,
  getPatientEvents,
  getPatientAlerts,
  getOpenAlerts,
  getTerritoryHeatmap,
  getEquipesSedes,
  getGestaoPainel,
  getInvisiveis,
  getVisitasStats,
  getEventosStats,
  searchPatients,
  createRelatoVisita,
  getRelatosVisita,
} from './lib/db.js';
import { recomputeAndSave } from './lib/scoring.js';
import { buildAgenda } from './lib/routing.js';
import { getIsochrones } from './lib/ors.js';
import { webhook } from './routes/webhook.js';
import { chat } from './routes/chat.js';
import { mediaRelato } from './routes/media-relato.js';

const app = new Hono();

// Lista de origens permitidas: localhost (dev) + FRONTEND_URL (Vercel em prod).
// Permite também qualquer subdomínio *.vercel.app pra preview deployments.
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter((o): o is string => Boolean(o));

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (allowedOrigins.includes(origin)) return origin;
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.json({ status: 'ok', service: 'impact-acs-backend' }));

app.get('/api/kpis', async (c) => {
  try {
    return c.json(await getKpis());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/gestao/painel', async (c) => {
  try {
    return c.json(await getGestaoPainel());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/gestao/invisiveis', async (c) => {
  try {
    const equipe_id = c.req.query('equipe_id') ?? undefined;
    const catStr = c.req.query('categoria');
    const categoria = (catStr === '1' || catStr === '2' || catStr === '3')
      ? (Number(catStr) as 1 | 2 | 3) : undefined;
    const limitStr = c.req.query('limit');
    const limit = limitStr ? Number(limitStr) : undefined;
    return c.json(await getInvisiveis({ equipe_id, categoria, limit }));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/equipes/:equipe_id/agenda', async (c) => {
  try {
    const equipe_id = c.req.param('equipe_id');
    const capStr = c.req.query('capacidade');
    const comStr = c.req.query('com_justificativas');

    const capacidade = capStr ? Math.max(1, Math.min(50, Number(capStr))) : undefined;
    const com_justificativas = comStr === 'true' || comStr === '1';

    const agenda = await buildAgenda({ equipe_id, capacidade, com_justificativas });
    if (!agenda) {
      return c.json({ error: `equipe ${equipe_id} não encontrada` }, 404);
    }
    return c.json(agenda);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/patients', async (c) => {
  try {
    const equipe_id = c.req.query('equipe_id');
    const score_min = c.req.query('score_min');
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');
    const patients = await listPatients({
      equipe_id: equipe_id ?? undefined,
      scoreMin: score_min ? Number(score_min) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    return c.json(patients);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/patients/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const paciente = await getPatient(id);
    if (!paciente) return c.json({ error: 'Not found' }, 404);
    const [visitas, eventos, alertas] = await Promise.all([
      getPatientVisits(id),
      getPatientEvents(id),
      getPatientAlerts(id),
    ]);
    return c.json({ paciente, visitas, eventos, alertas });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/alerts', async (c) => {
  try {
    return c.json(await getOpenAlerts(100));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/territory/heatmap', async (c) => {
  try {
    return c.json(await getTerritoryHeatmap());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/territory/equipes', async (c) => {
  try {
    return c.json(await getEquipesSedes());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.post('/api/territory/isochrones', async (c) => {
  try {
    const { lat, lng, ranges_min } = await c.req.json<{ lat: number; lng: number; ranges_min?: number[] }>();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return c.json({ error: 'lat e lng numéricos obrigatórios' }, 400);
    }
    const seconds = (ranges_min ?? [10, 15]).map(m => m * 60);
    const data = await getIsochrones(lat, lng, seconds, 'foot-walking');
    return c.json(data);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.post('/api/score/recompute/:id', async (c) => {
  const id = c.req.param('id');
  try {
    return c.json(await recomputeAndSave(id));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

app.route('/webhook', webhook);
app.route('/api/chat', chat);
app.route('/api/visitas', mediaRelato);

app.get('/api/visitas/stats', async (c) => {
  try {
    return c.json(await getVisitasStats());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/eventos/stats', async (c) => {
  try {
    return c.json(await getEventosStats());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ─── Busca de pacientes (para o formulário de registro) ──────────────────────
app.get('/api/patients/search', async (c) => {
  try {
    const q = c.req.query('q') ?? '';
    const equipe_id = c.req.query('equipe_id') ?? undefined;
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
    return c.json(await searchPatients(q, equipe_id, limit));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ─── Relatos de visita ────────────────────────────────────────────────────────
app.post('/api/visitas/relato', async (c) => {
  try {
    const body = await c.req.json();
    const {
      paciente_id, equipe_id, acs_nome,
      paciente_encontrado, condicao,
      orientacoes_dadas, medicamentos_verificados, encaminhamento_necessario,
      sinais_vitais_verificados, condicoes_moradia_ok, observacao,
    } = body;
    if (!paciente_id || !condicao) {
      return c.json({ error: 'paciente_id e condicao são obrigatórios' }, 400);
    }
    const relato = await createRelatoVisita({
      paciente_id, equipe_id: equipe_id ?? null, acs_nome: acs_nome ?? null,
      paciente_encontrado: paciente_encontrado !== false,
      condicao,
      orientacoes_dadas: !!orientacoes_dadas,
      medicamentos_verificados: !!medicamentos_verificados,
      encaminhamento_necessario: !!encaminhamento_necessario,
      sinais_vitais_verificados: !!sinais_vitais_verificados,
      condicoes_moradia_ok: condicoes_moradia_ok !== false,
      observacao: observacao ?? null,
    });
    return c.json(relato, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/patients/:id/relatos', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = Math.min(Number(c.req.query('limit') ?? 30), 100);
    return c.json(await getRelatosVisita(id, limit));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.post('/api/extract', async (c) => {
  const { text } = await c.req.json();
  try {
    const { extractMessage } = await import('./lib/extract.js');
    const data = await extractMessage(text);
    return c.json(data);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

const port = Number(process.env.PORT ?? 3001);
console.log(`Backend rodando em http://localhost:${port}`);
serve({ fetch: app.fetch, port });
