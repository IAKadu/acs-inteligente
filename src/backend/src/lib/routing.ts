/**
 * Roteirização nearest-neighbor a partir da sede da equipe.
 * Portado de inteligencia-no-territorio/projeto/pipeline/routing.py.
 * Distancia: Haversine (km).
 */

export interface Ponto {
  lat: number;
  lon: number;
}

export function haversineKm(a: Ponto, b: Ponto): number {
  const R = 6371.0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Retorna os indices de `pontos` na ordem de visita (NN a partir de `origem`).
 */
export function nearestNeighborOrder(origem: Ponto, pontos: Ponto[]): number[] {
  const restantes = new Set<number>(pontos.map((_, i) => i));
  const rota: number[] = [];
  let atual = origem;

  while (restantes.size > 0) {
    let melhor = -1;
    let melhorDist = Infinity;
    for (const i of restantes) {
      const d = haversineKm(atual, pontos[i]);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = i;
      }
    }
    rota.push(melhor);
    atual = pontos[melhor];
    restantes.delete(melhor);
  }

  return rota;
}

export interface RotaItem<T> {
  ordem_visita: number;
  paciente: T;
  distancia_anterior_km: number;
  distancia_acumulada_km: number;
}

/**
 * Ordena `candidatos` (cada um com `endereco_latitude`/`endereco_longitude`)
 * em uma rota NN a partir da sede. Retorna lista enriquecida.
 */
export function buildRota<T extends { endereco_latitude: number; endereco_longitude: number }>(
  sede: Ponto,
  candidatos: T[],
): RotaItem<T>[] {
  if (candidatos.length === 0) return [];

  const pontos: Ponto[] = candidatos.map(c => ({ lat: c.endereco_latitude, lon: c.endereco_longitude }));
  const ordem = nearestNeighborOrder(sede, pontos);

  const itens: RotaItem<T>[] = [];
  let acumulado = 0;
  let anterior: Ponto = sede;

  ordem.forEach((idx, i) => {
    const p = candidatos[idx];
    const ponto: Ponto = { lat: p.endereco_latitude, lon: p.endereco_longitude };
    const d = haversineKm(anterior, ponto);
    acumulado += d;
    itens.push({
      ordem_visita: i + 1,
      paciente: p,
      distancia_anterior_km: Math.round(d * 100) / 100,
      distancia_acumulada_km: Math.round(acumulado * 100) / 100,
    });
    anterior = ponto;
  });

  return itens;
}

import { getEquipeSede, getCandidatosAgenda, type CandidatoAgenda } from './db.js';
import { gerarJustificativa } from './justificativas.js';

export interface AgendaItem {
  ordem_visita: number;
  paciente_id: string;
  faixa_etaria: string;
  hipertenso: number;
  diabetico: number;
  gestacao: number;
  situacao_vulnerabilidade: number;
  score: number;
  prioridade: string | null;
  flag_invisivel: boolean;
  flag_crise_sem_vinculo: boolean;
  dias_sem_visita: number;
  n_urg_30d: number;
  n_urg_ano: number;
  tem_agendamento_futuro: boolean;
  distancia_anterior_km: number;
  distancia_acumulada_km: number;
  endereco_latitude: number;
  endereco_longitude: number;
  justificativa: string | null;
}

export interface Agenda {
  equipe_id: string;
  sede: { lat: number; lon: number };
  capacidade: number;
  total_itens: number;
  distancia_total_km: number;
  agenda: AgendaItem[];
}

const CAPACIDADE_PADRAO = 6;

export async function buildAgenda(opts: {
  equipe_id: string;
  capacidade?: number;
  com_justificativas?: boolean;
}): Promise<Agenda | null> {
  const cap = opts.capacidade ?? CAPACIDADE_PADRAO;
  const sede = await getEquipeSede(opts.equipe_id);
  if (!sede) return null;

  const candidatos = await getCandidatosAgenda(opts.equipe_id, cap);
  const rota = buildRota({ lat: sede.endereco_latitude, lon: sede.endereco_longitude }, candidatos);

  const itens: AgendaItem[] = [];
  for (const r of rota) {
    const c = r.paciente;
    const justificativa = opts.com_justificativas ? await gerarJustificativa(c) : null;
    itens.push({
      ordem_visita: r.ordem_visita,
      paciente_id: c.paciente_id,
      faixa_etaria: c.faixa_etaria,
      hipertenso: c.hipertenso,
      diabetico: c.diabetico,
      gestacao: c.gestacao,
      situacao_vulnerabilidade: c.situacao_vulnerabilidade,
      score: c.score,
      prioridade: c.prioridade,
      flag_invisivel: c.flag_invisivel,
      flag_crise_sem_vinculo: c.flag_crise_sem_vinculo,
      dias_sem_visita: c.dias_sem_visita,
      n_urg_30d: c.n_urg_30d,
      n_urg_ano: c.n_urg_ano,
      tem_agendamento_futuro: c.tem_agendamento_futuro,
      distancia_anterior_km: r.distancia_anterior_km,
      distancia_acumulada_km: r.distancia_acumulada_km,
      endereco_latitude: c.endereco_latitude,
      endereco_longitude: c.endereco_longitude,
      justificativa,
    });
  }

  const distancia_total_km = itens.length > 0 ? itens[itens.length - 1].distancia_acumulada_km : 0;

  return {
    equipe_id: opts.equipe_id,
    sede: { lat: sede.endereco_latitude, lon: sede.endereco_longitude },
    capacidade: cap,
    total_itens: itens.length,
    distancia_total_km,
    agenda: itens,
  };
}
