import { Hono } from 'hono';
import { extractMessage } from '../lib/extract.js';
import { sendWhatsapp } from '../lib/twilio.js';
import {
  insertRegistroWhatsapp,
  updateRegistroWhatsapp,
  insertVisita,
  insertAlerta,
} from '../lib/db.js';
import { recomputeAndSave } from '../lib/scoring.js';

export const webhook = new Hono();

webhook.post('/whatsapp', async (c) => {
  const body = await c.req.parseBody();
  const msgId = String(body.MessageSid ?? '');
  const from = String(body.From ?? '');
  const text = String(body.Body ?? '').trim();

  console.log(`WhatsApp recebido de ${from}: ${text}`);

  if (!text) {
    return c.text('<Response/>', 200, { 'Content-Type': 'application/xml' });
  }

  // 1. Persist raw
  const registroId = await insertRegistroWhatsapp({
    whatsapp_msg_id: msgId,
    from_number: from,
    profissional_id: null,
    mensagem_texto: text,
    dados_extraidos: null,
    paciente_id: null,
    status: 'recebido',
  });

  // 2. Extract via Claude
  let extracted;
  try {
    extracted = await extractMessage(text);
  } catch (err) {
    console.error('Falha extração:', err);
    await updateRegistroWhatsapp(registroId, { status: 'falha' });
    await sendWhatsapp(from, 'Tive um problema processando sua mensagem. Tente novamente.');
    return c.text('<Response/>', 200, { 'Content-Type': 'application/xml' });
  }

  const pacienteId = extracted.paciente_id_provavel;

  // 3. No match
  if (!pacienteId || extracted.confidence === 'baixa') {
    await updateRegistroWhatsapp(registroId, {
      dados_extraidos: JSON.stringify(extracted),
      status: 'falha',
    });
    const nome = extracted.paciente_referido ?? 'paciente';
    await sendWhatsapp(from, `Nao consegui identificar com certeza ${nome}. Me da mais contexto? (Ex: "Maria da Silva, equipe 3")`);
    return c.text('<Response/>', 200, { 'Content-Type': 'application/xml' });
  }

  // 4. Create derived visit
  await insertVisita({
    profissional_id: from,
    registrados_em: new Date().toISOString().slice(0, 10),
    ordem_visita_dia: 1,
    paciente_id: pacienteId,
    origem: 'whatsapp',
  });

  // 5. Create alerts
  for (const a of extracted.alertas) {
    await insertAlerta({
      paciente_id: pacienteId,
      tipo: a.tipo,
      mensagem: a.mensagem,
      prioridade: a.prioridade,
      origem: 'whatsapp',
    });
  }

  // 6. Recompute score
  const { score } = await recomputeAndSave(pacienteId);

  await updateRegistroWhatsapp(registroId, {
    dados_extraidos: JSON.stringify(extracted),
    paciente_id: pacienteId,
    status: 'processado',
  });

  // 7. Reply
  const alertaTxt = extracted.alertas.length
    ? ` Alerta: ${extracted.alertas[0].tipo}.`
    : '';
  await sendWhatsapp(
    from,
    `Registrado pra ${extracted.paciente_referido}. Score=${Math.round(score)}.${alertaTxt}`,
  );

  return c.text('<Response/>', 200, { 'Content-Type': 'application/xml' });
});
